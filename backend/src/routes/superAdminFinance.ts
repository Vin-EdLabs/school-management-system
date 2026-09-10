import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { wipeTermFinance } from '../services/superAdminFinanceWipeService.js';
import { forceCloseLedgerTerm } from '../services/superAdminForceCloseTermService.js';
import {
  deleteTermCompletely,
  getTermFinanceDeletePreview,
} from '../services/superAdminTermDeleteService.js';
import { clearArrears, getArrearsPreview } from '../services/superAdminArrearsService.js';
import { getClientIp } from '../utils/clientIp.js';

const router = express.Router();

router.use(authenticate, requireRole('super-admin'));

/** List ledger terms for a tenant (super admin). */
router.get('/tenants/:tenantId/terms', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }

    const result = await query(
      `SELECT t.id, t.name, t.status, t.is_current, t.closed_at,
              t.start_date, t.end_date, t.academic_year_id,
              COALESCE(ay.label, ay.name) AS academic_year,
              at.id AS academic_term_id,
              at.term_name AS academic_term_name,
              at.is_active AS academic_is_active,
              at.closed_at AS academic_closed_at,
              (
                SELECT COUNT(*)::int FROM student_ledger sl
                WHERE sl.tenant_id = t.tenant_id AND sl.term_id = t.id
              ) AS ledger_rows,
              (
                SELECT COALESCE(SUM(p.amount), 0)::numeric FROM payments p
                WHERE p.tenant_id = t.tenant_id AND p.term_id = t.id
                  AND COALESCE(p.is_voided, false) = false
              ) AS payments_total
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN academic_terms at
         ON at.tenant_id = t.tenant_id
        AND at.ledger_term_id = t.id
       WHERE t.tenant_id = $1
       ORDER BY t.start_date ASC NULLS LAST, t.id ASC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[superadmin finance] list terms error:', error);
    res.status(500).json({ error: 'Failed to list terms' });
  }
});

/** Preview all finance data linked to a ledger term before delete/reset. */
router.get('/tenants/:tenantId/terms/:termId/delete-preview', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const termId = parseInt(req.params.termId, 10);
    if (Number.isNaN(tenantId) || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid tenant or term id' });
    }
    const preview = await getTermFinanceDeletePreview(tenantId, termId);
    res.set('Cache-Control', 'no-store');
    res.json(preview);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load delete preview';
    console.error('[superadmin finance] delete-preview error:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * Permanently delete a ledger term and all of its finance data.
 * Does not recreate a ledger. Students and non-term finance are preserved.
 */
router.delete('/tenants/:tenantId/terms/:termId', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const termId = parseInt(req.params.termId, 10);
    if (Number.isNaN(tenantId) || Number.isNaN(termId)) {
      return res.status(400).json({ error: 'Invalid tenant or term id' });
    }

    const confirm = String(req.body?.confirm || '').trim();
    if (confirm !== 'DELETE TERM') {
      return res.status(400).json({
        error: 'Confirmation required. Send { "confirm": "DELETE TERM" } in the request body.',
      });
    }

    const result = await deleteTermCompletely({
      tenantId,
      ledgerTermId: termId,
      actorUserId: req.user!.id,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Term delete failed';
    console.error('[superadmin finance] delete term error:', error);
    res.status(400).json({ error: message });
  }
});

/** List classes for a tenant. */
router.get('/tenants/:tenantId/classes', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }
    const result = await query(
      `SELECT id, COALESCE(NULLIF(TRIM(class_name), ''), 'Class ' || id) AS name
       FROM classes
       WHERE tenant_id = $1
       ORDER BY name ASC`,
      [tenantId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[superadmin finance] list classes error:', error);
    res.status(500).json({ error: 'Failed to list classes' });
  }
});

/** Search students for a tenant. */
router.get('/tenants/:tenantId/students', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const q = String(req.query.q || '').trim();
    if (Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }

    const result = await query(
      `SELECT id, first_name, last_name, admission_number, class_assigned_id
       FROM students
       WHERE tenant_id = $1
         AND (
           $2 = ''
           OR first_name ILIKE '%' || $2 || '%'
           OR last_name ILIKE '%' || $2 || '%'
           OR admission_number ILIKE '%' || $2 || '%'
         )
       ORDER BY last_name ASC, first_name ASC
       LIMIT 50`,
      [tenantId, q]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('[superadmin finance] list students error:', error);
    res.status(500).json({ error: 'Failed to list students' });
  }
});

const wipeSchema = z.object({
  tenant_id: z.number().int(),
  term_id: z.number().int(),
  scope: z.enum(['student', 'class', 'school']),
  student_id: z.number().int().optional(),
  class_id: z.number().int().optional(),
});

router.delete('/wipe', async (req: AuthRequest, res) => {
  try {
    const body = wipeSchema.parse(req.body);
    const result = await wipeTermFinance({
      tenantId: body.tenant_id,
      termId: body.term_id,
      scope: body.scope,
      studentId: body.student_id ?? null,
      classId: body.class_id ?? null,
      actorUserId: req.user!.id,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Finance wipe failed';
    console.error('[superadmin finance] wipe error:', error);
    res.status(400).json({ error: message });
  }
});

/** Force-close an unused open ledger term (super admin, no term switch). */
router.post('/tenants/:tenantId/terms/:termId/force-close', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    const ledgerTermId = parseInt(req.params.termId, 10);
    if (Number.isNaN(tenantId) || Number.isNaN(ledgerTermId)) {
      return res.status(400).json({ error: 'Invalid tenant or term id' });
    }

    const result = await forceCloseLedgerTerm({
      tenantId,
      ledgerTermId,
      actorUserId: req.user!.id,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Force close failed';
    console.error('[superadmin finance] force-close error:', error);
    res.status(400).json({ error: message });
  }
});

/**
 * Arrears-only cleanup — never touches fee structures, payments, invoices, or
 * the terms themselves. Deletes exactly the student_ledger rows with
 * entry_type = 'arrears' for the tenant (optionally scoped to one student).
 */
router.get('/tenants/:tenantId/arrears/preview', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }
    const studentIdRaw = req.query.studentId;
    const studentId =
      studentIdRaw != null && String(studentIdRaw).trim() !== '' ? parseInt(String(studentIdRaw), 10) : null;
    if (studentId != null && Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student id' });
    }

    const preview = await getArrearsPreview(tenantId, studentId);
    res.json(preview);
  } catch (error: unknown) {
    console.error('[superadmin finance] arrears preview error:', error);
    res.status(500).json({ error: 'Failed to load arrears preview' });
  }
});

const clearArrearsSchema = z.object({
  student_id: z.number().int().nullable().optional(),
  confirm: z.literal('CLEAR ARREARS'),
});

router.delete('/tenants/:tenantId/arrears', async (req: AuthRequest, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId, 10);
    if (Number.isNaN(tenantId)) {
      return res.status(400).json({ error: 'Invalid tenant id' });
    }
    const body = clearArrearsSchema.parse(req.body);

    const result = await clearArrears({
      tenantId,
      studentId: body.student_id ?? null,
      actorUserId: req.user!.id,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') ?? null,
    });
    res.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to clear arrears';
    console.error('[superadmin finance] clear arrears error:', error);
    res.status(400).json({ error: message });
  }
});

export default router;
