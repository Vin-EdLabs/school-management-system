import express, { Response } from 'express';
import { getClient, query } from '../db/connection.js';
import {
  getStudentSummary,
  postFeesForClass,
  recordPayment,
  postFeesForNewTerm,
  postFeesForNewTermWithArrears,
  backfillArrearsForCurrentTerm,
  resolveLedgerTermFromSettings,
  recordManualBalanceOverride,
} from '../services/ledgerFinanceService.js';
import { writeOffArrears } from '../services/ledgerPaymentService.js';
import { authenticate, requireTenant, AuthRequest, requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { z } from 'zod';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';
import {
  formatMoneyGhs,
  resolveActorFromRequest,
  resolveStudentLabel,
  withActor,
} from '../utils/auditResolve.js';
import { buildStudentFinanceStatement } from '../services/studentFinanceStatementService.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { requireCompleteFeeStructures } from '../middleware/requireCompleteFeeStructures.js';
import studentChargesRouter from './studentCharges.js';

const router = express.Router();

const emitTenantDataChanged = (tenantId: number, entity: string, action: 'created' | 'updated' | 'deleted') => {
  try {
    const io = getIO();
    io.to(`tenant:${tenantId}`).emit('tenant-data-changed', { tenantId, entity, action, at: Date.now() });
  } catch {
    // Socket server may be unavailable in some non-realtime contexts.
  }
};

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);
attachWritableTermGuard(router, { skipActiveTermPaths: ['/switch-term'] });

router.use('/student-charges', studentChargesRouter);

function getTenantId(req: AuthRequest): number {
  const id = req.user!.tenantId!;
  if (id == null) throw new Error('Tenant context required');
  return id;
}

const financeBalanceOverrideRoles = requireRole('super-admin', 'administrator', 'finance');
const financeStatementRoles = requireRole('super-admin', 'administrator', 'finance');

const OVERRIDE_REASONS = z.enum([
  'wrong_arrears',
  'payment_not_captured',
  'fee_waiver',
  'system_error',
  'other',
]);

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse ledger description for before/after balances (legacy rows may only list the new balance after "→"). */
function parseManualOverrideBalances(
  description: string | null | undefined,
  adjustmentAmount: unknown,
  debit: unknown,
  credit: unknown
): { balance_before: number | null; balance_after: number | null } {
  const adj =
    adjustmentAmount != null && adjustmentAmount !== ''
      ? Number(adjustmentAmount)
      : Number(debit || 0) - Number(credit || 0);
  const desc = String(description || '');
  const paired = desc.match(/GH₵\s*([\d,.]+)\s*→\s*GH₵\s*([\d,.]+)/);
  if (paired) {
    const before = parseFloat(paired[1].replace(/,/g, ''));
    const after = parseFloat(paired[2].replace(/,/g, ''));
    if (Number.isFinite(before) && Number.isFinite(after)) {
      return { balance_before: before, balance_after: after };
    }
  }
  const legacy = desc.match(/→\s*GH₵\s*([\d,.]+)/);
  if (legacy) {
    const after = parseFloat(legacy[1].replace(/,/g, ''));
    if (Number.isFinite(after) && Number.isFinite(adj)) {
      return { balance_after: after, balance_before: roundMoney(after - adj) };
    }
  }
  return { balance_before: null, balance_after: null };
}

/** GET /api/finance/student-override-search?q= — find students for manual balance override UI */
router.get('/student-override-search', financeBalanceOverrideRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const q = String(req.query.q || '').trim();
    if (q.length < 1) {
      return res.status(400).json({ error: 'Enter a search term (student ID, admission no., or name).' });
    }
    const pattern = `%${q.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    const result = await query(
      `SELECT s.id, s.first_name, s.last_name, s.student_id, s.admission_number, c.class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_assigned_id AND c.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1
         AND (
           s.student_id ILIKE $2
           OR s.admission_number ILIKE $2
           OR CAST(s.id AS text) = $3
           OR (s.first_name || ' ' || s.last_name) ILIKE $2
           OR s.first_name ILIKE $2
           OR s.last_name ILIKE $2
         )
       ORDER BY s.last_name, s.first_name
       LIMIT 30`,
      [tenantId, pattern, q]
    );
    return res.json({ matches: result.rows });
  } catch (e: any) {
    console.error('student-override-search:', e);
    return res.status(500).json({ error: 'Student search failed.' });
  }
});

// GET /api/finance/student/:id/summary
router.get('/student/:id/summary', async (req: AuthRequest, res: Response) => {
  try {
    const studentId = parseInt(req.params.id, 10);
    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID.' });
    }
    const summary = await getStudentSummary(getTenantId(req), studentId);
    return res.json(summary);
  } catch (error: any) {
    console.error('Error fetching student summary:', error);
    return res.status(500).json({ error: 'Failed to fetch student financial summary.' });
  }
});

// POST /api/finance/post-fees
router.post('/post-fees', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      classId: z.number().int(),
      academicYearId: z.number().int(),
      termId: z.number().int(),
    });
    const validatedBody = schema.parse(req.body);
    const result = await postFeesForClass(
      getTenantId(req),
      validatedBody.classId,
      validatedBody.academicYearId,
      validatedBody.termId
    );
    
    // Trigger background arrears refresh
    const tenantId = getTenantId(req);
    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
        emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
      } catch (e) {
        console.error('Background arrears refresh error (post-fees):', e);
      }
    })();

    emitTenantDataChanged(tenantId, 'finance-fees', 'updated');
    return res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body.', details: error.errors });
    }
    console.error('Error posting fees:', error);
    return res.status(500).json({ error: error.message || 'Failed to post fees.' });
  }
});

// POST /api/finance/payment
router.post('/payment', requireCompleteFeeStructures, async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      studentId: z.number().int(),
      academicYearId: z.number().int(),
      termId: z.number().int(),
      amount: z.number().positive(),
      description: z.string().optional(),
      paymentMethod: z.string().optional(),
      receiptNumber: z.string().optional(),
    });
    const validatedBody = schema.parse(req.body);
    const tenantId = getTenantId(req);
    const paymentData = {
      ...validatedBody,
      tenantId,
    };
    const payment = await recordPayment(paymentData);
    
    // Trigger background arrears refresh
    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
        emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
      } catch (e) {
        console.error('Background arrears refresh error (payment):', e);
      }
    })();

    emitTenantDataChanged(tenantId, 'finance-payment', 'created');

    // Push for finance-ledger payment path (this is commonly used in production).
    const studentRow = await (await import('../db/connection.js')).query(
      'SELECT first_name, last_name FROM students WHERE tenant_id = $1 AND id = $2',
      [tenantId, validatedBody.studentId]
    ).catch(() => ({ rows: [] as any[] }));
    const studentName = studentRow.rows[0]
      ? `${studentRow.rows[0].first_name} ${studentRow.rows[0].last_name}`.trim()
      : 'Your ward';
    await sendPushToStudentParents(tenantId, validatedBody.studentId, {
      title: 'Fee Payment Received',
      body: `${studentName}: GHS ${Number(validatedBody.amount).toFixed(2)} payment has been recorded.`,
      url: `/portal/${tenantId}`,
    }).catch(() => {});

    return res.status(201).json(payment);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body.', details: error.errors });
    }
    console.error('Error recording payment:', error);
    return res.status(500).json({ error: error.message || 'Failed to record payment.' });
  }
});

// GET /api/finance/terms — get all ledger terms with IDs for this tenant
router.get('/terms', async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { query } = await import('../db/connection.js');
    const result = await query(
      `SELECT t.id, t.name, t.is_current, t.status, t.closed_at,
              ay.id as academic_year_id, ay.name as academic_year_name
       FROM terms t
       INNER JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1
       ORDER BY ay.name DESC, t.id ASC`,
      [tenantId]
    );
    return res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching ledger terms:', error);
    return res.status(500).json({ error: 'Failed to fetch ledger terms.' });
  }
});

// POST /api/finance/backfill-arrears — backfill arrears for current term (from settings). Idempotent.
router.post('/backfill-arrears', async (req: AuthRequest, res: Response) => {
  try {
    const result = await backfillArrearsForCurrentTerm(getTenantId(req));
    emitTenantDataChanged(getTenantId(req), 'finance-arrears', 'updated');
    return res.json(result);
  } catch (error: any) {
    console.error('Error backfilling arrears:', error);
    return res.status(500).json({ error: error.message || 'Failed to backfill arrears.' });
  }
});

// POST /api/finance/switch-term — MANDATORY term switch with automatic arrears carry-forward
// This MUST succeed or throw error. No silent failures allowed.
router.post('/switch-term', async (req: AuthRequest, res: Response) => {
  try {
    const schema = z.object({
      newTermId: z.number().int(),
      currentTermId: z.number().int().optional(),
    });
    const validatedBody = schema.parse(req.body);
    const tenantId = getTenantId(req);
    
    if (validatedBody.currentTermId) {
      const { isLedgerTermClosed } = await import('../services/termCloseService.js');
      const closed = await isLedgerTermClosed(tenantId, validatedBody.currentTermId);
      if (!closed) {
        return res.status(400).json({
          error:
            'Close the current term before switching to a new one. Go to Settings → Academic Terms → Close Term.',
        });
      }
    }

    // If no currentTermId, this is the first term ever - just post fees, no arrears to carry
    if (!validatedBody.currentTermId) {
      console.log(`[switch-term] First term detected (no currentTermId). Posting fees only for term ${validatedBody.newTermId}`);
      const result = await postFeesForNewTerm(tenantId, validatedBody.newTermId);
      emitTenantDataChanged(tenantId, 'finance-term-switch', 'updated');
      return res.json({ ...result, message: 'First term - fees posted. No arrears to carry forward.' });
    }
    
    if (validatedBody.currentTermId === validatedBody.newTermId) {
      return res.status(400).json({ 
        error: 'CRITICAL: Cannot switch to the same term. currentTermId and newTermId must be different.' 
      });
    }
    
    // FORCE arrears carry-forward - this MUST succeed
    const result = await postFeesForNewTermWithArrears(
      tenantId,
      validatedBody.currentTermId,
      validatedBody.newTermId
    );
    
    // AUTOMATICALLY REFRESH term_arrears TABLE
    try {
      // Get the name/year of the new term to force the sync for it
      const { query } = await import('../db/connection.js');
      const newTermRes = await query(
        `SELECT t.name, ay.name as year 
         FROM terms t 
         JOIN academic_years ay ON t.academic_year_id = ay.id 
         WHERE t.id = $1`, 
        [validatedBody.newTermId]
      );
      const newTermData = newTermRes.rows[0];

      const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
      await refreshArrearsForTenant(tenantId, newTermData?.name, newTermData?.year);
      console.log(`[switch-term] Successfully auto-refreshed term_arrears for NEW term ${newTermData?.name} ${newTermData?.year}`);
    } catch (refreshErr) {
      console.error('[switch-term] Warning: Arrears refresh failed after switch:', refreshErr);
      // We don't fail the whole request since the ledger work succeeded
    }
    
    console.log(`[switch-term] SUCCESS: Switched from term ${validatedBody.currentTermId} to ${validatedBody.newTermId}. Arrears rows: ${result.arrearsRowsInserted}`);
    emitTenantDataChanged(tenantId, 'finance-term-switch', 'updated');
    return res.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'CRITICAL: Invalid request body.', details: error.errors });
    }
    // FAIL LOUDLY - do not hide errors
    console.error('[switch-term] CRITICAL ERROR:', error);
    const errorMessage = error?.message || 'CRITICAL: Term switch failed. Check backend logs for details.';
    return res.status(500).json({ 
      error: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    });
  }
});

// POST /api/finance/carry-arrears
// Body: { previousTerm: string }  e.g. { previousTerm: "Term 1 2027" }
// 1. Gets current active term string from school_settings.
// 2. For each student: calculates outstanding = fee_structures - payments for previousTerm.
// 3. Upserts a row into term_arrears for the current term.
// This works purely with term-name strings — no ledger IDs needed.
router.post('/carry-arrears', async (req: AuthRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const client = await getClient();
  try {
    const schema = z.object({ previousTerm: z.string().min(1) });
    const { previousTerm } = schema.parse(req.body);

    await client.query('BEGIN');

    // 1. Get current term from school_settings
    const settingsRes = await client.query(
      `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    if (settingsRes.rows.length === 0 || !settingsRes.rows[0].current_term) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No active term set. Go to Settings and set the current term first.' });
    }
    const { current_term, current_year } = settingsRes.rows[0];
    const currentTermFull = current_year
      ? `${current_term} ${current_year}`.trim()
      : current_term;

    if (previousTerm === currentTermFull || previousTerm === current_term) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Previous term cannot be the same as the current term.' });
    }

    console.log(`[carry-arrears] from="${previousTerm}" to="${currentTermFull}"`);

    // 2. Get all students with their class
    const studentsRes = await client.query(
      `SELECT s.id, s.class_assigned_id FROM students s WHERE s.tenant_id = $1 AND s.class_assigned_id IS NOT NULL`,
      [tenantId]
    );

    // 3. Get fee per class for the previous term
    //    Match "Term 1 2027", "Term 1", or partial variants
    const prevShort = previousTerm.replace(/\s+\d{4}$/, '').trim(); // strip year if present
    const feeRes = await client.query(
      `SELECT class_id, COALESCE(SUM(amount), 0)::numeric AS total_fee
       FROM fee_structures
       WHERE tenant_id = $1
         AND (term = $2 OR term = $3 OR term ILIKE $4 OR term ILIKE $5)
       GROUP BY class_id`,
      [tenantId, previousTerm, prevShort, `%${previousTerm}%`, `%${prevShort}%`]
    );
    const feeByClass: Record<number, number> = {};
    for (const r of feeRes.rows) feeByClass[Number(r.class_id)] = parseFloat(r.total_fee) || 0;

    // 4. Get payments per student for the previous term
    const payRes = await client.query(
      `SELECT student_id, COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0)::numeric AS total_paid
       FROM payments
       WHERE tenant_id = $1
         AND COALESCE(is_voided, false) = false
         AND (term = $2 OR term = $3 OR term ILIKE $4 OR term ILIKE $5)
       GROUP BY student_id`,
      [tenantId, previousTerm, prevShort, `%${previousTerm}%`, `%${prevShort}%`]
    );
    const paidByStudent: Record<number, number> = {};
    for (const r of payRes.rows) paidByStudent[Number(r.student_id)] = parseFloat(r.total_paid) || 0;

    // 5. Upsert arrears for each student with an outstanding balance
    let arrearsInserted = 0;
    let arrearsUpdated = 0;
    let skipped = 0;

    for (const s of studentsRes.rows) {
      const studentId = Number(s.id);
      const classId = Number(s.class_assigned_id);
      const fee = feeByClass[classId] ?? 0;
      const paid = paidByStudent[studentId] ?? 0;
      const outstanding = Math.max(0, fee - paid);

      if (outstanding <= 0) { skipped++; continue; }

      const upsertRes = await client.query(
        `INSERT INTO term_arrears (tenant_id, student_id, current_term, from_term, amount)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, student_id, current_term)
         DO UPDATE SET amount = EXCLUDED.amount, from_term = EXCLUDED.from_term
         RETURNING (xmax = 0) AS inserted`,
        [tenantId, studentId, currentTermFull, previousTerm, outstanding]
      );
      if (upsertRes.rows[0]?.inserted) arrearsInserted++;
      else arrearsUpdated++;

      console.log(`[carry-arrears] student=${studentId} fee=${fee} paid=${paid} arrears=${outstanding}`);
    }

    await client.query('COMMIT');

    console.log(`[carry-arrears] DONE inserted=${arrearsInserted} updated=${arrearsUpdated} skipped=${skipped}`);
    emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
    return res.json({
      message: `Arrears from "${previousTerm}" carried to "${currentTermFull}". ${arrearsInserted} new, ${arrearsUpdated} updated.`,
      arrearsRowsInserted: arrearsInserted + arrearsUpdated,
      skipped,
      previousTerm,
      currentTerm: currentTermFull,
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body.', details: error.errors });
    }
    console.error('[carry-arrears] ERROR:', error);
    return res.status(500).json({ error: error.message || 'Failed to carry arrears.' });
  } finally {
    client.release();
  }
});

// POST /api/finance/clear-all-payments
// Wipes ALL finance data for this tenant so admins can configure fresh.
router.post('/clear-all-payments', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE payments SET corrects_payment_id = NULL, corrected_by_payment_id = NULL WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => {});
    await client.query(
      `UPDATE fund_transfers SET original_transfer_id = NULL WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => {});

    await client.query('DELETE FROM receipt_corrections WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM receipts WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM fund_transfers WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM income WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM salary_payments WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM expenses WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM payments WHERE tenant_id = $1', [tenantId]);
    await client.query('DELETE FROM payment_accounts WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_ledger WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM ledger_fee_structures WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM fee_structures WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM term_arrears WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_arrears WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_arrears_balance WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_credits WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM term_outstanding_balances WHERE tenant_id = $1', [tenantId]).catch(() => {});

    await client.query('DELETE FROM terms WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM academic_years WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM academic_terms WHERE tenant_id = $1', [tenantId]).catch(() => {});

    await client.query(
      `UPDATE school_settings SET current_term = NULL, current_year = NULL, legacy_payment_migration_completed = false WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => {});

    await client.query(
      `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
       VALUES ($1, 0, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id) DO UPDATE SET last_number = 0, updated_at = CURRENT_TIMESTAMP`,
      [tenantId]
    );

    await client.query(
      `UPDATE school_settings SET legacy_payment_migration_completed = false WHERE tenant_id = $1`,
      [tenantId]
    ).catch(() => {});

    await client.query('COMMIT');
    emitTenantDataChanged(tenantId, 'finance', 'deleted');
    return res.json({
      message:
        'All finance data cleared: fees, payments, receipts, income, expenses, payroll payments, payment accounts, arrears, ledger terms, and academic terms have been reset. Set your active term and fee structures fresh in Settings.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error clearing finance data:', error);
    return res.status(500).json({ error: error.message || 'Failed to clear finance data.' });
  } finally {
    client.release();
  }
});

const __financeFilename = fileURLToPath(import.meta.url);
const __financeDirname = path.dirname(__financeFilename);
const FINANCE_ADJUST_UPLOAD_DIR = path.join(__financeDirname, '../../uploads/finance-adjustments');
const manualBalanceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/** GET /api/finance/manual-adjustments — audited report */
router.get('/manual-adjustments', financeBalanceOverrideRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const schema = z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      studentId: z.coerce.number().int().optional(),
      createdBy: z.coerce.number().int().optional(),
      minAmount: z.coerce.number().optional(),
      maxAmount: z.coerce.number().optional(),
    });
    const q = schema.parse(req.query);

    const params: unknown[] = [tenantId];
    let p = 2;
    let where = `sl.tenant_id = $1 AND sl.entry_type = 'manual_adjustment'`;

    if (q.from) {
      where += ` AND sl.created_at >= $${p}::timestamptz`;
      params.push(q.from);
      p++;
    }
    if (q.to) {
      where += ` AND sl.created_at <= $${p}::timestamptz`;
      params.push(q.to);
      p++;
    }
    if (q.studentId) {
      where += ` AND sl.student_id = $${p}`;
      params.push(q.studentId);
      p++;
    }
    if (q.createdBy) {
      where += ` AND sl.created_by_user_id = $${p}`;
      params.push(q.createdBy);
      p++;
    }
    if (q.minAmount != null && !Number.isNaN(q.minAmount)) {
      where += ` AND ABS(COALESCE(sl.adjustment_amount, sl.debit - sl.credit)) >= $${p}`;
      params.push(q.minAmount);
      p++;
    }
    if (q.maxAmount != null && !Number.isNaN(q.maxAmount)) {
      where += ` AND ABS(COALESCE(sl.adjustment_amount, sl.debit - sl.credit)) <= $${p}`;
      params.push(q.maxAmount);
      p++;
    }

    const rows = await query(
      `SELECT sl.id, sl.student_id, sl.created_at, sl.description, sl.debit, sl.credit, sl.adjustment_amount,
              sl.adjustment_category, sl.adjustment_notes, sl.supporting_document_url,
              sl.approved_by_user_id, sl.created_by_user_id, sl.period_label,
              s.first_name, s.last_name, s.student_id AS school_student_id,
              cu.username AS created_by_username, cu.full_name AS created_by_full_name,
              au.username AS approved_by_username, au.full_name AS approved_by_full_name
       FROM student_ledger sl
       INNER JOIN students s ON s.id = sl.student_id AND s.tenant_id = sl.tenant_id
       LEFT JOIN users cu ON cu.id = sl.created_by_user_id
       LEFT JOIN users au ON au.id = sl.approved_by_user_id
       WHERE ${where}
       ORDER BY sl.created_at DESC
       LIMIT 500`,
      params
    );
    const adjustments = rows.rows.map((r: Record<string, unknown>) => {
      const { balance_before, balance_after } = parseManualOverrideBalances(
        r.description as string,
        r.adjustment_amount,
        r.debit,
        r.credit
      );
      const full = (r.created_by_full_name as string | null)?.trim();
      const user = (r.created_by_username as string | null)?.trim();
      const recorded_by_display =
        full && user && full.toLowerCase() !== user.toLowerCase() ? `${full} (${user})` : full || user || null;
      return { ...r, balance_before, balance_after, recorded_by_display };
    });
    return res.json({ adjustments });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query filters.', details: e.errors });
    }
    console.error('manual-adjustments report:', e);
    return res.status(500).json({ error: 'Failed to load manual adjustments.' });
  }
});

/**
 * POST /api/finance/student/:id/manual-balance-override
 * multipart: newBalance, reasonCategory, notes, document?
 * Period is always the active term from School Settings (no term picker).
 */
router.post(
  '/student/:id/manual-balance-override',
  financeBalanceOverrideRoles,
  manualBalanceUpload.single('document'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const studentId = parseInt(req.params.id, 10);
      if (Number.isNaN(studentId)) {
        return res.status(400).json({ error: 'Invalid student id.' });
      }

      const bodySchema = z.object({
        newBalance: z.coerce.number().finite(),
        reasonCategory: OVERRIDE_REASONS,
        notes: z.string().trim().min(5, 'Notes are required (at least 5 characters).'),
      });

      const parsed = bodySchema.safeParse({
        newBalance: req.body.newBalance,
        reasonCategory: req.body.reasonCategory,
        notes: req.body.notes,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }
      const { newBalance, reasonCategory, notes } = parsed.data;

      const stu = await query('SELECT id FROM students WHERE id = $1 AND tenant_id = $2', [studentId, tenantId]);
      if (stu.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const summary = await getStudentSummary(tenantId, studentId);
      const currentBalance = roundMoney(Number(summary.balance));
      const targetBalance = roundMoney(newBalance);
      const adjustmentAmount = roundMoney(targetBalance - currentBalance);

      if (adjustmentAmount === 0) {
        return res.status(400).json({ error: 'New balance matches current balance. No adjustment needed.' });
      }

      let academicYearId: number;
      let termId: number;
      let periodLabel: string | null = null;

      const settings = await query(
        'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      const ct = settings.rows[0]?.current_term;
      const cy = settings.rows[0]?.current_year;
      if (!ct || !cy) {
        return res.status(400).json({ error: 'Set the active term and year in School Settings before recording a balance override.' });
      }
      const resolved = await resolveLedgerTermFromSettings(tenantId, String(cy), String(ct));
      if (!resolved) {
        return res.status(400).json({ error: 'Could not resolve the active term to a ledger term. Check Settings → academic year and term names.' });
      }
      academicYearId = resolved.academicYearId;
      termId = resolved.termId;
      periodLabel = `${ct} ${cy}`.trim();

      let documentUrl: string | null = null;
      if (req.file?.buffer?.length) {
        await fs.mkdir(FINANCE_ADJUST_UPLOAD_DIR, { recursive: true });
        const ext = path.extname(req.file.originalname || '').slice(0, 8) || '.bin';
        const safe = `${tenantId}-${studentId}-${Date.now()}${ext}`;
        const diskPath = path.join(FINANCE_ADJUST_UPLOAD_DIR, safe);
        await fs.writeFile(diskPath, req.file.buffer);
        documentUrl = `/uploads/finance-adjustments/${safe}`;
      }

      const row = await recordManualBalanceOverride({
        tenantId,
        studentId,
        academicYearId,
        termId,
        newBalance: targetBalance,
        adjustmentAmount,
        reasonCategory,
        notes,
        documentUrl,
        createdByUserId: req.user!.id,
        approvedByUserId: null,
        periodLabel,
      });

      const studentLabel = await resolveStudentLabel(tenantId, studentId);
      const actor = await resolveActorFromRequest(req);

      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'MANUAL_BALANCE_OVERRIDE',
        entityType: 'STUDENT',
        entityId: studentId,
        module: 'finance',
        status: 'success',
        summary: withActor(
          `Manual balance adjustment for ${studentLabel} — ${formatMoneyGhs(currentBalance)} → ${formatMoneyGhs(targetBalance)} (${reasonCategory})`,
          actor
        ),
        details: {
          ledgerEntryId: row.id,
          reasonCategory,
          adjustmentAmount,
          approvedByUserId: null,
          periodLabel,
          hasDocument: !!documentUrl,
        },
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] as string | undefined,
      });

      (async () => {
        try {
          const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
          await refreshArrearsForTenant(tenantId);
          emitTenantDataChanged(tenantId, 'finance-arrears', 'updated');
        } catch (e) {
          console.error('Arrears refresh after manual override:', e);
        }
      })();

      emitTenantDataChanged(tenantId, 'finance-ledger', 'updated');

      const nextSummary = await getStudentSummary(tenantId, studentId);
      return res.status(201).json({
        ledgerEntry: row,
        previousBalance: currentBalance,
        newBalance: roundMoney(Number(nextSummary.balance)),
        adjustmentAmount,
      });
    } catch (e: any) {
      console.error('manual-balance-override:', e);
      return res.status(500).json({ error: e.message || 'Failed to apply manual balance override.' });
    }
  }
);

const WRITE_OFF_REASONS = z.enum([
  'Scholarship',
  'Hardship Waiver',
  'Data Correction',
  'Management Decision',
  'Other',
]);

/**
 * POST /api/finance/student/:id/write-off-arrears
 * Admin-only partial or full arrears write-off (ledger manual_adjustment credit).
 */
router.post(
  '/student/:id/write-off-arrears',
  requireRole('super-admin', 'administrator', 'finance'),
  async (req: AuthRequest, res: Response) => {
    try {
      const tenantId = getTenantId(req);
      const studentId = parseInt(req.params.id, 10);
      if (Number.isNaN(studentId)) {
        return res.status(400).json({ error: 'Invalid student id.' });
      }

      const schema = z.object({
        amount: z.coerce.number().positive('Write-off amount must be greater than zero'),
        reason: WRITE_OFF_REASONS,
        notes: z.string().trim().min(5, 'Notes are required (at least 5 characters).'),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten().fieldErrors });
      }

      const stu = await query('SELECT id FROM students WHERE id = $1 AND tenant_id = $2', [studentId, tenantId]);
      if (stu.rows.length === 0) {
        return res.status(404).json({ error: 'Student not found.' });
      }

      const result = await writeOffArrears(
        tenantId,
        studentId,
        parsed.data.amount,
        parsed.data.reason,
        parsed.data.notes,
        req.user!.id
      );

      const studentLabel = await resolveStudentLabel(tenantId, studentId);
      const actor = await resolveActorFromRequest(req);

      await writeAuditLog({
        tenantId,
        userId: req.user!.id,
        userRole: req.user!.role,
        action: 'ARREARS_WRITE_OFF',
        entityType: 'STUDENT',
        entityId: studentId,
        module: 'finance',
        status: 'success',
        summary: withActor(
          `Arrears write-off of ${formatMoneyGhs(parsed.data.amount)} for ${studentLabel} — ${parsed.data.reason}`,
          actor
        ),
        details: {
          amount: parsed.data.amount,
          reason: parsed.data.reason,
          notes: parsed.data.notes,
          newOutstanding: result.newOutstanding,
        },
        ipAddress: getClientIp(req),
        userAgent: req.get('user-agent') || null,
      });

      emitTenantDataChanged(tenantId, 'finance', 'updated');
      emitTenantDataChanged(tenantId, 'fee', 'updated');

      return res.json({
        message: `GHS ${parsed.data.amount.toFixed(2)} written off successfully.`,
        ...result,
      });
    } catch (e: any) {
      return res.status(400).json({ error: e.message || 'Failed to write off arrears.' });
    }
  }
);

/**
 * POST /api/finance/ledger-backfill
 * Backfill missing ledger entries from existing payments and fee structures.
 */
router.post('/ledger-backfill', requireRole('super-admin', 'administrator'), async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { runLedgerBackfill } = await import('../services/ledgerBackfillService.js');
    const result = await runLedgerBackfill(tenantId, req.user!.id);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'LEDGER_BACKFILL',
      entityType: 'FINANCE',
      entityId: tenantId,
      module: 'finance',
      status: 'success',
      summary: `Ledger backfill: ${result.paymentsAdded} payments, ${result.termFeesAdded} term fees added`,
      details: result,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    return res.json(result);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Ledger backfill failed.' });
  }
});

/** GET /api/finance/students/:studentId/statement — full finance statement data */
router.get('/students/:studentId/statement', financeStatementRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const statement = await buildStudentFinanceStatement(tenantId, studentId, {
      variant: 'official',
      generatedByName: req.user!.fullName || req.user!.username,
      generatedByRole: req.user!.role,
    });
    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    return res.json({ statement });
  } catch (e: unknown) {
    console.error('Finance statement error:', e);
    return res.status(500).json({ error: (e as Error).message || 'Failed to build finance statement' });
  }
});

/** POST /api/finance/students/:studentId/statement/download — audit log when PDF is downloaded */
router.post('/students/:studentId/statement/download', financeStatementRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const statement = await buildStudentFinanceStatement(tenantId, studentId, {
      variant: 'official',
      generatedByName: req.user!.fullName || req.user!.username,
      generatedByRole: req.user!.role,
    });
    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FINANCE_STATEMENT_GENERATED',
      entityType: 'STUDENT',
      entityId: studentId,
      module: 'finance',
      status: 'success',
      summary: `Finance statement downloaded for ${statement.header.studentName} (${statement.header.studentId})`,
      details: {
        studentName: statement.header.studentName,
        studentId: statement.header.studentId,
        generatedBy: statement.header.generatedBy,
        generatedByRole: statement.header.generatedByRole,
        generatedAt: statement.header.dateGenerated,
        generatedVia: 'finance_statement_page',
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('Finance statement download audit error:', e);
    return res.status(500).json({ error: (e as Error).message || 'Failed to log download' });
  }
});

/** POST /api/finance/students/:studentId/statement/send-to-parent — notify parent portal with finance statement alert */
router.post('/students/:studentId/statement/send-to-parent', financeStatementRoles, async (req: AuthRequest, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const studentId = parseInt(String(req.params.studentId), 10);
    if (Number.isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    const statement = await buildStudentFinanceStatement(tenantId, studentId, {
      variant: 'parent_portal',
    });
    if (!statement) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const parentCheck = await query(
      `SELECT COUNT(*)::int AS total
       FROM parent_portal_accounts
       WHERE tenant_id = $1 AND student_id = $2 AND is_active = true`,
      [tenantId, studentId]
    );
    const parentAccounts = Number(parentCheck.rows[0]?.total || 0);
    if (parentAccounts === 0) {
      return res.status(400).json({
        error: 'No active parent portal account for this student. Set up parent access in Parent Accounts first.',
      });
    }

    const balanceLabel =
      statement.accountSummary.balanceKind === 'DR'
        ? `Balance: GHS ${statement.accountSummary.currentBalance.toFixed(2)} owing`
        : statement.accountSummary.balanceKind === 'CR'
          ? `Credit: GHS ${statement.accountSummary.currentBalance.toFixed(2)}`
          : 'Fully paid';

    const pushResult = await sendPushToStudentParents(tenantId, studentId, {
      title: 'Finance Statement Available',
      body: `${statement.header.studentName}'s finance statement is ready. ${balanceLabel}. Tap to view or download.`,
      url: '?tab=finance&openStatement=1',
    });

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FINANCE_STATEMENT_SENT_TO_PARENT',
      entityType: 'STUDENT',
      entityId: studentId,
      module: 'finance',
      status: 'success',
      summary: `Finance statement sent to parent for ${statement.header.studentName} (${statement.header.studentId})`,
      details: {
        studentName: statement.header.studentName,
        studentId: statement.header.studentId,
        sentBy: req.user!.fullName || req.user!.username,
        sentByRole: req.user!.role,
        parentAccountsNotified: pushResult.parentAccounts,
        pushSubscribers: pushResult.subscribedAccounts,
        currentBalance: statement.accountSummary.currentBalance,
        balanceKind: statement.accountSummary.balanceKind,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTenantDataChanged(tenantId, 'finance-statement-sent', 'created');

    return res.json({
      ok: true,
      parentAccounts: pushResult.parentAccounts,
      subscribedAccounts: pushResult.subscribedAccounts,
    });
  } catch (e: unknown) {
    console.error('Finance statement send-to-parent error:', e);
    return res.status(500).json({ error: (e as Error).message || 'Failed to send statement to parent' });
  }
});

export default router;