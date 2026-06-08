import express from 'express';
import { query, getClient } from '../db/connection.js';
import { authenticate, requireTenant, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/auth.js';
import { setTenantContext } from '../middleware/tenant.js';
import { calculateFeeBalance } from '../services/financeCalculationService.js';
import { getIO } from '../socket.js';
import { sendPushToStudentParents } from '../services/webPushService.js';
import { writeAuditLog } from '../services/auditService.js';
import { getClientIp } from '../utils/clientIp.js';

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

/** Resolve term string for matching fee_structures and payments */
function resolveTermForMatch(term: string | null, _academicYear: string | null): string | null {
  return term ? String(term).trim() : null;
}

/** Compute total fees and total paid for a student, return balance (all backend, dynamic) */
async function getStudentFeeBalance(
  client: any,
  tenantId: number,
  studentId: number,
  term: string | null,
  academicYear: string | null
) {
  const studentRes = await client.query(
    'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;
  const classId = studentRes.rows[0].class_assigned_id;
  if (!classId) return calculateFeeBalance(0, 0);

  const termMatch = resolveTermForMatch(term, academicYear) || term;
  if (!termMatch) return calculateFeeBalance(0, 0);

  const feeRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND (term = $3 OR $3 LIKE term || '%' OR term LIKE $3 || '%')`,
    [tenantId, classId, termMatch]
  );
  const totalFees = parseFloat(feeRes.rows[0]?.total || '0');

  let paidRes;
  try {
    paidRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE tenant_id = $1 AND student_id = $2 AND (term = $3 OR $3 LIKE term || '%' OR term LIKE $3 || '%')`,
      [tenantId, studentId, termMatch]
    );
  } catch {
    // Legacy schema fallback: payments.term may not exist.
    paidRes = await client.query(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payments
       WHERE tenant_id = $1 AND student_id = $2`,
      [tenantId, studentId]
    );
  }
  const totalPaid = parseFloat(paidRes.rows[0]?.total || '0');

  // Fetch arrears from term_arrears
  const arrearsRes = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM term_arrears
     WHERE tenant_id = $1 AND student_id = $2 AND (current_term = $3 OR $3 LIKE current_term || '%' OR current_term LIKE $3 || '%')`,
    [tenantId, studentId, termMatch]
  );
  const arrears = Math.max(0, parseFloat(arrearsRes.rows[0]?.total || '0'));

  return calculateFeeBalance(totalFees, totalPaid, arrears);
}

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

// Get all payments
router.get('/', async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { studentId, term, startDate, endDate } = req.query;

    let queryText = `
      SELECT p.id, p.tenant_id, p.student_id, p.amount, p.payment_date, p.payment_method,
             p.term, p.notes, p.receipt_number, p.receipt_snapshot, p.created_at, p.updated_at,
             s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_assigned_id = c.id
      WHERE p.tenant_id = $1
    `;
    const params: any[] = [tenantId];

    if (studentId) {
      queryText += ' AND p.student_id = $2';
      params.push(studentId);
      if (term) {
        queryText += ' AND (p.term = $3 OR p.term LIKE $4)';
        params.push(term, `${term}%`);
      }
    } else if (term) {
      queryText += ' AND (p.term = $2 OR p.term LIKE $3)';
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
               s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
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
                 s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
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
                s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
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
                  s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
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
                  s.first_name, s.last_name, s.student_id as admission_no, s.admission_number, c.class_name
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
router.post('/', requireRole('super-admin', 'administrator', 'finance'), async (req: AuthRequest, res) => {
  try {
    const tenantId = req.user!.tenantId!;
    const { student_id, amount, payment_date, payment_method, term, notes, academic_year } = req.body;

    if (!student_id || !amount || !payment_date) {
      return res.status(400).json({ error: 'Student ID, amount, and payment date are required' });
    }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be a positive number' });
    }

    const studentRes = await query(
      'SELECT id FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const settingsRes = await query(
      'SELECT receipt_prefix FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    const receiptPrefix = settingsRes.rows[0]?.receipt_prefix || 'R';

    const receiptNumber = await generateReceiptNumber(tenantId, receiptPrefix);

    const termStr = term || '';
    const yearStr = academic_year || '';
    const termToStore = (yearStr && !termStr.includes(yearStr)) 
      ? `${termStr} ${yearStr}`.trim() 
      : termStr;

    let insertResult;
    try {
      insertResult = await query(
        `INSERT INTO payments (tenant_id, student_id, amount, payment_date, payment_method, term, notes, receipt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          tenantId,
          student_id,
          paymentAmount,
          payment_date,
          payment_method || null,
          termToStore || term || null,
          notes || null,
          receiptNumber,
        ]
      );
    } catch {
      try {
        // Legacy schema fallback: payment_method may not exist.
        insertResult = await query(
          `INSERT INTO payments (tenant_id, student_id, amount, payment_date, term, notes, receipt_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            tenantId,
            student_id,
            paymentAmount,
            payment_date,
            termToStore || term || null,
            notes || null,
            receiptNumber,
          ]
        );
      } catch {
        try {
          // Legacy schema fallback: both payment_method and term may be missing.
          insertResult = await query(
            `INSERT INTO payments (tenant_id, student_id, amount, payment_date, notes, receipt_number)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [
              tenantId,
              student_id,
              paymentAmount,
              payment_date,
              notes || null,
              receiptNumber,
            ]
          );
        } catch {
          // Oldest schema fallback: notes may be missing as well.
          insertResult = await query(
            `INSERT INTO payments (tenant_id, student_id, amount, payment_date, receipt_number)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [tenantId, student_id, paymentAmount, payment_date, receiptNumber]
          );
        }
      }
    }
    const payment = insertResult.rows[0];

    const client = await getClient();
    let balance = null;
    let receiptSnapshot: Record<string, number> | null = null;
    try {
      balance = await getStudentFeeBalance(
        client,
        tenantId,
        parseInt(student_id, 10),
        term || null,
        academic_year || null
      );
      if (balance) {
        const totalFees = Number(balance.totalFees) || 0;
        const arrearsNum = Number(balance.arrears) || 0;
        const outstanding = Number(balance.outstanding);
        receiptSnapshot = {
          totalDue: totalFees + arrearsNum,
          termFee: totalFees,
          arrears: arrearsNum,
          balanceAfter: Math.max(0, Number.isFinite(outstanding) ? outstanding : 0),
          credit: Number(balance.credit) || 0,
        };
      }
    } finally {
      client.release();
    }

    if (receiptSnapshot) {
      try {
        await query(
          `UPDATE payments SET receipt_snapshot = $1::jsonb WHERE id = $2 AND tenant_id = $3`,
          [JSON.stringify(receiptSnapshot), payment.id, tenantId]
        );
      } catch (snapErr) {
        console.error('[payments] Failed to persist receipt_snapshot:', snapErr);
      }
    }

    const paymentOut = { ...payment, receipt_snapshot: receiptSnapshot };

    const studentNameRes = await query(
      'SELECT first_name, last_name, student_id as school_student_code FROM students WHERE tenant_id = $1 AND id = $2',
      [tenantId, student_id]
    ).catch(() => ({ rows: [] as any[] }));
    const studentName = studentNameRes.rows[0]
      ? `${studentNameRes.rows[0].first_name} ${studentNameRes.rows[0].last_name}`.trim()
      : 'Student';
    const schoolStudentCode = studentNameRes.rows[0]?.school_student_code || '';

    // Get student's class and current academic period IDs for ledger entry
    const studentInfo = await query(
      'SELECT class_assigned_id FROM students WHERE id = $1 AND tenant_id = $2',
      [student_id, tenantId]
    );
    const classId = studentInfo.rows[0]?.class_assigned_id;

    // Resolve term and academic year IDs for ledger matching
    let termId = null;
    let academicYearId = 1; // Default fallback for now if no hard link exists

    if (termStr) {
      // 1. Try to find the term by name/year string in academic_terms
      const termLookup = await query(
        `SELECT id FROM academic_terms 
         WHERE tenant_id = $1 AND (
           (term_name || ' ' || year) = $2 
           OR term_name = $2 
           OR term_name = $3
         )
         LIMIT 1`,
        [tenantId, termToStore || termStr, termStr.split(' ')[0]]
      );

      if (termLookup.rows.length > 0) {
        termId = termLookup.rows[0].id;
      } else {
        // 2. Fallback: If we can't find it by string, use the current active term from settings
        const activeTermLookup = await query(
          `SELECT t.id FROM academic_terms t
           JOIN school_settings s ON (s.current_term = (t.term_name || ' ' || t.year) OR s.current_term = t.term_name)
           WHERE t.tenant_id = $1 AND s.tenant_id = $1
           LIMIT 1`,
          [tenantId]
        );
        if (activeTermLookup.rows.length > 0) {
          termId = activeTermLookup.rows[0].id;
        }
      }
    }

    // If we have term context, post to student_ledger
    if (termId) {
      try {
        await query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type)
           VALUES ($1, $2, $3, $4, $5, 0, $6, 'payment')`,
          [
            tenantId,
            student_id,
            academicYearId,
            termId,
            `Payment - ${receiptNumber}${notes ? ': ' + notes : ''}`,
            paymentAmount
          ]
        );
      } catch (ledgerErr) {
        console.error('[payments] Failed to post to ledger:', ledgerErr);
      }
    }

    await writeAuditLog({
      tenantId,
      userId: req.user!.id,
      userRole: req.user!.role,
      action: 'FEE_PAYMENT',
      entityType: 'PAYMENT',
      entityId: paymentOut.id,
      module: 'finance',
      status: 'success',
      summary: `Recorded fee payment GHS ${paymentAmount.toLocaleString()} for ${studentName} (receipt ${receiptNumber})`,
      details: {
        paymentId: paymentOut.id,
        studentId: student_id,
        studentName,
        schoolStudentCode,
        amount: paymentAmount,
        receiptNumber,
        term: termToStore || term || null,
        paymentMethod: payment_method || null,
        balanceAfter: receiptSnapshot?.balanceAfter ?? null,
      },
      ipAddress: getClientIp(req),
      userAgent: req.get('user-agent') || null,
    });
    emitTenantDataChanged(tenantId, 'payment', 'created');
    await sendPushToStudentParents(tenantId, Number(student_id), {
      title: 'Fee Payment Received',
      body: `${studentName}: GHS ${paymentAmount.toFixed(2)} was received. Receipt #${receiptNumber}.`,
      url: `/parent/${tenantId}`,
    }).catch(() => {});

    res.status(201).json({
      payment: paymentOut,
      balance: balance || undefined,
    });

    // ASYNC: Refresh arrears in background so the current term balance stays correct
    // (If payment was for a previous term, current term arrears should drop)
    (async () => {
      try {
        const { refreshArrearsForTenant } = await import('../services/arrearsService.js');
        await refreshArrearsForTenant(tenantId);
      } catch (err) {
        console.error('[payments] Background arrears refresh failed:', err);
      }
    })();
  } catch (error) {
    console.error('Create payment error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

export default router;
