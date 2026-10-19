import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { recordPaymentWithLedger } from '../services/ledgerPaymentService.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';
import { sendSmsToStudentParents } from '../services/arkeselService.js';
import { writeAuditLog } from '../services/auditService.js';
import { formatMoneyGhs, resolveActorFromRequest, resolveStudentLabel, withActor } from '../utils/auditResolve.js';
import { getClientIp } from '../utils/clientIp.js';
import { resolvePaymentAccountForTransaction } from '../services/paymentAccountService.js';
import {
  correctReceipt,
  getCorrectionContext,
  getCorrectionEligibility,
  getCorrectionHistory,
  listReceiptCorrections,
} from '../services/receiptCorrectionService.js';
import { evaluateBudgetAlerts } from '../services/termBudgetService.js';
import { resolveActiveLedgerTerm } from '../services/studentUnifiedBalanceService.js';
import { attachWritableTermGuard } from '../middleware/attachWritableTermGuard.js';
import { requireCompleteFeeStructures } from '../middleware/requireCompleteFeeStructures.js';

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
attachWritableTermGuard(router);

/** Generate receipt number: R + 8 digits (e.g. R00012345), unique per school */
async function generateReceiptNumber(tenantId: number, receiptPrefix?: string): Promise<string> {
  const client = await getClient();
  try {
    const prefix = receiptPrefix || 'R';
    const res = await client.query(
      `INSERT INTO receipt_number_seq (tenant_id, last_number, updated_at)
       VALUES ($1, 1, CURRENT_TIMESTAMP)
       ON CONFLICT (tenant_id) DO UPDATE SET
         last_number = receipt_number_seq.last_number + 1,
         updated_at = CURRENT_TIMESTAMP
       RETURNING last_number`,
      [tenantId]
    );
    const lastNum = res.rows.length > 0 ? parseInt(String(res.rows[0].last_number), 10) : 1;
    return `${prefix}${String(lastNum).padStart(8, '0')}`;
  } finally {
    client.release();
  }
}

const PAYMENT_CORRECTION_COLUMNS = `
  p.payment_account_id, p.is_voided, p.is_locked, p.locked_at, p.base_receipt_number,
  p.receipt_version, p.correction_reason, p.corrected_at, p.corrected_by_user_id,
  p.corrects_payment_id, p.corrected_by_payment_id`;

// Receipt corrections audit log (administrators only)
router.get('/corrections', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { startDate, endDate, userId, studentId, limit, offset } = req.query;
    const result = await listReceiptCorrections(tenantId, {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      userId: userId ? parseInt(String(userId), 10) : undefined,
      studentId: studentId ? parseInt(String(studentId), 10) : undefined,
      limit: limit ? parseInt(String(limit), 10) : 50,
      offset: offset ? parseInt(String(offset), 10) : 0,
    });
    res.json(result);
  } catch (error) {
    console.error('List receipt corrections error:', error);
    res.status(500).json({ error: 'Failed to fetch receipt corrections' });
  }
});

// Get all payments — default: current term only; ?all=true for all terms; ?archived=true for prior terms
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId, term, startDate, endDate, archived, all, receiptNumber, receipt } = req.query;

    const receiptSearch = String(receiptNumber || receipt || '').trim();
    const showAll = String(all || '').toLowerCase() === 'true';
    const showArchived = String(archived || '').toLowerCase() === 'true';

    const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);

    let queryText = `
      SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date, p.payment_method,
             p.term, p.term_id, p.notes, p.receipt_number, p.receipt_snapshot, p.created_at, p.updated_at,
             ${PAYMENT_CORRECTION_COLUMNS},
             s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (receiptSearch) {
      queryText += ` AND (p.receipt_number = $${params.length + 1} OR p.receipt_number ILIKE $${params.length + 2})`;
      params.push(receiptSearch, `%${receiptSearch}%`);
    } else if (!showAll) {
      if (showArchived) {
        if (ledgerTermId) {
          queryText += ` AND (p.term_id IS NULL OR p.term_id != $${params.length + 1})`;
          params.push(ledgerTermId);
        }
      } else {
        queryText += ` AND COALESCE(p.is_voided, false) = false`;
        if (ledgerTermId) {
          queryText += ` AND p.term_id = $${params.length + 1}`;
          params.push(ledgerTermId);
        } else if (term) {
          queryText += ` AND (p.term = $${params.length + 1} OR p.term LIKE $${params.length + 2})`;
          params.push(term, `${term}%`);
        }
      }
    }

    if (studentId) {
      queryText += ` AND p.student_id = $${params.length + 1}`;
      params.push(studentId);
    } else if (!receiptSearch && !showAll && !showArchived && term && !ledgerTermId) {
      queryText += ` AND (p.term = $${params.length + 1} OR p.term LIKE $${params.length + 2})`;
      params.push(term, `${term}%`);
    }

    if (startDate && endDate) {
      const paramIndex = params.length + 1;
      queryText += ` AND p.payment_date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
      params.push(startDate, endDate);
    }

    queryText += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    let result;
    try {
      result = await query(queryText, params);
    } catch {
      // Legacy schema fallback: payment_method column may be missing.
      let fallbackQuery = `
        SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date,
               p.notes, p.receipt_number, p.created_at, p.updated_at,
               ''::text as term,
               ''::text as payment_method,
               s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
        FROM payments p
        LEFT JOIN students s ON p.student_id = s.id
        LEFT JOIN classes c ON s.class_assigned_id = c.id
        WHERE p.tenant_id = $1
      `;
      const fallbackParams: any[] = [tenantId];
      if (studentId) {
        fallbackQuery += ` AND p.student_id = $${fallbackParams.length + 1}`;
        fallbackParams.push(studentId);
      }
      if (startDate && endDate) {
        fallbackQuery += ` AND p.payment_date BETWEEN $${fallbackParams.length + 1} AND $${fallbackParams.length + 2}`;
        fallbackParams.push(startDate, endDate);
      }
      fallbackQuery += ' ORDER BY p.payment_date DESC, p.created_at DESC';
      try {
        result = await query(fallbackQuery, fallbackParams);
      } catch {
        // Older schema fallback: notes column may also be missing.
        let fallbackQueryNoNotes = `
          SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date,
                 p.receipt_number, NULL::jsonb as receipt_snapshot, p.created_at, p.updated_at,
                 ''::text as notes,
                 ''::text as term,
                 ''::text as payment_method,
                 s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
          FROM payments p
          LEFT JOIN students s ON p.student_id = s.id
          LEFT JOIN classes c ON s.class_assigned_id = c.id
          WHERE p.tenant_id = $1
        `;
        const fallbackParamsNoNotes: any[] = [tenantId];
        if (studentId) {
          fallbackQueryNoNotes += ` AND p.student_id = $${fallbackParamsNoNotes.length + 1}`;
          fallbackParamsNoNotes.push(studentId);
        }
        if (startDate && endDate) {
          fallbackQueryNoNotes += ` AND p.payment_date BETWEEN $${fallbackParamsNoNotes.length + 1} AND $${fallbackParamsNoNotes.length + 2}`;
          fallbackParamsNoNotes.push(startDate, endDate);
        }
        fallbackQueryNoNotes += ' ORDER BY p.payment_date DESC, p.created_at DESC';
        result = await query(fallbackQueryNoNotes, fallbackParamsNoNotes);
      }
    }
    res.json(result.rows);
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Check if a payment can be corrected
router.get('/:id/correction-eligibility', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const paymentId = parseInt(req.params.id, 10);
    const context = await getCorrectionContext(tenantId, paymentId);
    res.json(context.eligibility);
  } catch (error: any) {
    console.error('Correction eligibility error:', error);
    res.status(error?.message === 'Payment not found' ? 404 : 500).json({
      error: error?.message || 'Failed to check correction eligibility',
    });
  }
});

router.get('/:id/correction-history', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const paymentId = parseInt(req.params.id, 10);
    const history = await getCorrectionHistory(tenantId, paymentId);
    res.json(history);
  } catch (error: any) {
    console.error('Correction history error:', error);
    res.status(error?.message === 'Payment not found' ? 404 : 500).json({
      error: error?.message || 'Failed to fetch correction history',
    });
  }
});

// Correction context for modal (student balance, original receipt, eligibility)
router.get('/:id/correction-context', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const paymentId = parseInt(req.params.id, 10);
    const context = await getCorrectionContext(tenantId, paymentId);
    res.json(context);
  } catch (error: any) {
    console.error('Correction context error:', error);
    res.status(error?.message === 'Payment not found' ? 404 : 500).json({
      error: error?.message || 'Failed to load correction context',
    });
  }
});

// Correct a receipt (finance staff, within 7 days)
router.post(
  '/:id/correct',
  requireRole('super-admin', 'administrator', 'finance'),
  requireCompleteFeeStructures,
  async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const paymentId = parseInt(req.params.id, 10);
    const {
      amount,
      payment_date,
      payment_method,
      payment_account_id,
      student_id,
      reason,
      correction_type,
      term,
      notes,
    } = req.body;

    const result = await correctReceipt(tenantId, paymentId, req.user!.id, {
      amount: parseFloat(amount),
      payment_date,
      payment_method,
      payment_account_id: payment_account_id ? parseInt(String(payment_account_id), 10) : undefined,
      student_id: parseInt(String(student_id), 10),
      reason,
      correction_type,
      term,
      notes,
    });

    const bv = result.beforeValues as Record<string, unknown>;
    const av = result.afterValues as Record<string, unknown>;
    const studentLabel = await resolveStudentLabel(tenantId, parseInt(String(student_id), 10));
    const actor = await resolveActorFromRequest(req);
    const correctionLabel =
      String(correction_type || bv.correction_type || 'correction').toLowerCase() === 'debit'
        ? 'Debit correction'
        : 'Credit correction';

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'RECEIPT_CORRECTION',
      entityType: 'PAYMENT',
      entityId: result.corrected.id,
      module: 'finance',
      status: 'success',
      summary: withActor(
        `${correctionLabel} for ${studentLabel} — receipt ${bv.receipt_number} updated to ${formatMoneyGhs(av.amount ?? amount)}`,
        actor
      ),
      details: {
        correctionId: result.correction.id,
        originalPaymentId: result.beforeValues.payment_id,
        rootReceiptNumber: bv.root_receipt_number,
        correctedPaymentId: result.corrected.id,
        student: bv.student_label || bv.student_name,
        correctionType: bv.correction_type,
        amountChange: bv.amount_change_label,
        balanceBefore: bv.balance_outstanding_before,
        balanceAfter: av.balance_outstanding_after,
        methodChange: av.method_change_label,
        dateChange: av.date_change_label,
        reason: req.body.reason,
        before: bv,
        after: av,
      },
      beforeValues: result.beforeValues,
      afterValues: result.afterValues,
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });

    emitTenantDataChanged(tenantId, 'payment', 'updated');
    emitTenantDataChanged(tenantId, 'payment-account', 'updated');
    emitTenantDataChanged(tenantId, 'finance', 'updated');

    await sendPushToStudentParents(tenantId, result.afterValues.student_id, {
      title: 'Receipt Updated',
      body: "Your child's receipt has been updated. Tap to view.",
      url: `/parent/${tenantId}`,
    }).catch(() => {});

    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
      } catch (err) {
        console.error('[payments] Background arrears refresh after correction failed:', err);
      }
    })();

    res.json({
      original: result.original,
      corrected: result.corrected,
      correction: result.correction,
      message: `Receipt ${result.beforeValues.receipt_number} has been corrected. New receipt ${result.afterValues.receipt_number} created.`,
    });
  } catch (error: any) {
    console.error('Correct receipt error:', error);
    res.status(400).json({ error: error?.message || 'Failed to correct receipt' });
  }
});

// Get single payment
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { id } = req.params;

    let result;
    try {
      result = await query(
        `SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date, p.payment_method,
                p.term, p.notes, p.receipt_number, p.receipt_snapshot, p.created_at, p.updated_at,
                s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
         FROM payments p
         LEFT JOIN students s ON p.student_id = s.id
         LEFT JOIN classes c ON s.class_assigned_id = c.id
         WHERE p.id = $1 AND p.tenant_id = $2`,
        [id, tenantId]
      );
    } catch {
      try {
        result = await query(
          `SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date,
                  p.notes, p.receipt_number, NULL::jsonb as receipt_snapshot, p.created_at, p.updated_at,
                  ''::text as payment_method,
                  ''::text as term,
                  s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
           FROM payments p
           LEFT JOIN students s ON p.student_id = s.id
           LEFT JOIN classes c ON s.class_assigned_id = c.id
           WHERE p.id = $1 AND p.tenant_id = $2`,
          [id, tenantId]
        );
      } catch {
        result = await query(
          `SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date,
                  p.receipt_number, NULL::jsonb as receipt_snapshot, p.created_at, p.updated_at,
                  ''::text as notes,
                  ''::text as payment_method,
                  ''::text as term,
                  s.first_name, s.last_name, s.student_id as student_id_code, s.student_id as school_student_code, s.student_id as admission_no, s.admission_number, c.class_name
           FROM payments p
           LEFT JOIN students s ON p.student_id = s.id
           LEFT JOIN classes c ON s.class_assigned_id = c.id
           WHERE p.id = $1 AND p.tenant_id = $2`,
          [id, tenantId]
        );
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

// Create payment - adds to payments table; totals are computed dynamically on next fetch
// Never overwrite or delete payments.
router.post(
  '/',
  requireRole('super-admin', 'administrator', 'finance'),
  requireCompleteFeeStructures,
  async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, amount, payment_date, payment_method, payment_account_id, term, notes, academic_year } = req.body;

    if (!student_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Student ID, amount, and payment date are required' });
    }

    let resolvedMethod = payment_method || null;
    let resolvedAccountId: number | null = null;
    try {
      const resolved = await resolvePaymentAccountForTransaction(
        tenantId,
        payment_account_id ? parseInt(String(payment_account_id), 10) : null,
        payment_method
      );
      resolvedAccountId = resolved.paymentAccountId;
      resolvedMethod = resolved.paymentMethod;
    } catch (err: any) {
      return res.status(400).json({ error: err?.message || 'Invalid payment account' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number' });
    }

    const studentRes = await query(
      `SELECT id, COALESCE(enrollment_status, 'active') AS enrollment_status
       FROM students WHERE id = $1 AND tenant_id = $2`,
      [student_id, tenantId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (String(studentRes.rows[0].enrollment_status).toLowerCase() !== 'active') {
      return res.status(400).json({ error: 'Payments can only be recorded for active enrolled students' });
    }

    const settingsRes = await query(
      'SELECT receipt_prefix FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const receiptPrefix = settingsRes.rows[0]?.receipt_prefix || 'R';

    const receiptNumber = await generateReceiptNumber(tenantId, receiptPrefix);

    const termStr = term || '';
    const yearStr = academic_year || '';
    const termToStore =
      yearStr && !termStr.includes(yearStr) ? `${termStr} ${yearStr}`.trim() : termStr;

    let result;
    try {
      result = await recordPaymentWithLedger({
        tenantId,
        studentId: parseInt(String(student_id), 10),
        amount: paymentAmount,
        paymentDate: payment_date,
        paymentMethod: resolvedMethod,
        paymentAccountId: resolvedAccountId,
        termLabel: termToStore || termStr || null,
        notes: notes || null,
        receiptNumber,
        createdByUserId: req.user!.id,
      });
    } catch (ledgerErr: any) {
      return res.status(400).json({ error: ledgerErr?.message || 'Failed to record payment on ledger' });
    }

    const paymentOut = result.payment;
    const receiptSnapshot = result.receiptSnapshot;
    const balance = result.balance;

    const studentNameRes = await query(
      'SELECT first_name, last_name, student_id as school_student_code FROM students WHERE tenant_id = $1 AND id = $2',
      [tenantId, student_id]
    ).catch(() => ({ rows: [] as any[] }));
    const studentName = studentNameRes.rows[0]
      ? `${studentNameRes.rows[0].first_name} ${studentNameRes.rows[0].last_name}`.trim()
      : 'Student';
    const schoolStudentCode = studentNameRes.rows[0]?.school_student_code || '';

    const actor = await resolveActorFromRequest(req);

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: Number(paymentOut.id),
      module: 'finance',
      status: 'success',
      summary: withActor(
        `Payment of ${formatMoneyGhs(paymentAmount)} recorded for ${studentName}${schoolStudentCode ? ` (ID: ${schoolStudentCode})` : ''} — receipt ${receiptNumber}`,
        actor
      ),
      details: {
        paymentId: paymentOut.id,
        studentId: student_id,
        studentName,
        schoolStudentCode,
        amount: paymentAmount,
        receiptNumber,
        term: termToStore || term || null,
        paymentMethod: resolvedMethod,
        allocation: receiptSnapshot,
        outstandingAfter: receiptSnapshot.outstandingAfter,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'payment', 'created');
    evaluateBudgetAlerts(tenantId).catch(() => undefined);
    await sendPushToStudentParents(tenantId, Number(student_id), {
      title: 'Fee Payment Received',
      body: `${studentName}: GHS ${paymentAmount.toFixed(2)} was received. Receipt #${receiptNumber}.`,
      url: `/parent/${tenantId}`,
    }).catch(() => {});

    // Outbound SMS notification to parent
    const outstandingText =
      receiptSnapshot?.outstandingAfter != null
        ? ` Outstanding balance: GHS ${Number(receiptSnapshot.outstandingAfter).toFixed(2)}.`
        : '';
    const paymentSmsText = `Receipt #${receiptNumber}: GHS ${paymentAmount.toFixed(2)} received for ${studentName}.${outstandingText} Thank you.`;
    sendSmsToStudentParents(tenantId, Number(student_id), paymentSmsText, 'payment').catch((err) => {
      console.warn('[payments] Failed to dispatch SMS:', err?.message || err);
    });

    res.status(201).json({
      payment: paymentOut,
      balance,
    });

    // Refresh term_arrears cache for legacy report compatibility
    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
      } catch (err) {
        console.error('[payments] Background arrears cache refresh failed:', err);
      }
    })();
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

export default router;
