import express, { Response } from 'express';
import { getClient } from '../db/connection.js';
import { getStudentSummary, postFeesForClass, recordPayment, postFeesForNewTerm, postFeesForNewTermWithArrears, backfillArrearsForCurrentTerm } from '../services/ledgerFinanceService.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { z } from 'zod';

const router = express.Router();

router.use(authenticate);
router.use(requireTenant);
router.use(setTenantContext);

function getTenantId(req: AuthRequest): number {
  const id = req.user!.tenantId!;
  if (id == null) throw new Error('Tenant context required');
  return id;
}

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
router.post('/payment', async (req: AuthRequest, res: Response) => {
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
    const paymentData = {
      ...validatedBody,
      tenantId: getTenantId(req),
    };
    const payment = await recordPayment(paymentData);
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
      `SELECT t.id, t.name, t.is_current, ay.id as academic_year_id, ay.name as academic_year_name
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
    
    // If no currentTermId, this is the first term ever - just post fees, no arrears to carry
    if (!validatedBody.currentTermId) {
      console.log(`[switch-term] First term detected (no currentTermId). Posting fees only for term ${validatedBody.newTermId}`);
      const result = await postFeesForNewTerm(tenantId, validatedBody.newTermId);
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
      `SELECT student_id, COALESCE(SUM(amount), 0)::numeric AS total_paid
       FROM payments
       WHERE tenant_id = $1
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
// Wipes ALL finance data for this tenant: fee structures, payments, receipts, arrears.
router.post('/clear-all-payments', async (req: AuthRequest, res: Response) => {
  const tenantId = getTenantId(req);
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Receipts reference payments — delete first
    await client.query('DELETE FROM receipts WHERE tenant_id = $1', [tenantId]);

    // Payments
    await client.query('DELETE FROM payments WHERE tenant_id = $1', [tenantId]);

    // Fee structures
    await client.query('DELETE FROM fee_structures WHERE tenant_id = $1', [tenantId]).catch(() => {});

    // Carried-forward arrears (new simple table)
    await client.query('DELETE FROM term_arrears WHERE tenant_id = $1', [tenantId]).catch(() => {});

    // Legacy helper tables (may not exist — ignore errors)
    await client.query('DELETE FROM student_arrears WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_arrears_balance WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_credits WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM term_outstanding_balances WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM ledger_fee_structures WHERE tenant_id = $1', [tenantId]).catch(() => {});
    await client.query('DELETE FROM student_ledger WHERE tenant_id = $1', [tenantId]).catch(() => {});

    // Reset receipt number sequence
    await client.query(
      `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
       VALUES ($1, 0, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id) DO UPDATE SET last_number = 0, updated_at = CURRENT_TIMESTAMP`,
      [tenantId]
    );

    await client.query('COMMIT');
    return res.json({
      message: 'All finance data cleared: fee structures, payments, receipts, and arrears have been reset.',
    });
  } catch (error: any) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error clearing finance data:', error);
    return res.status(500).json({ error: error.message || 'Failed to clear finance data.' });
  } finally {
    client.release();
  }
});

export default router;