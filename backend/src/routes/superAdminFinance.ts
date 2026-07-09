import express from 'express';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth.js';
import { query } from '../db/connection.js';
import { wipeTermFinance } from '../services/superAdminFinanceWipeService.js';
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
              ay.name AS academic_year,
              at.term_name AS academic_term_name, at.is_active AS academic_is_active
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       LEFT JOIN academic_terms at
         ON at.tenant_id = t.tenant_id
        AND at.ledger_term_id = t.id
       WHERE t.tenant_id = $1
       ORDER BY ay.name DESC, t.id DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('[superadmin finance] list terms error:', error);
    res.status(500).json({ error: 'Failed to list terms' });
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
      `SELECT id, COALESCE(NULLIF(TRIM(class_name), ''), NULLIF(TRIM(name), ''), 'Class ' || id) AS name
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

export default router;
