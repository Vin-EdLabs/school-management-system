import type pg from 'pg';
import { getClient } from '../db/connection.js';
import {
  allocatePayment,
  buildReceiptSnapshot,
  getCurrentTermPaymentContext,
  resolveActiveLedgerTerm,
  getStudentFullBalance,
} from './studentUnifiedBalanceService.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export type RecordLedgerPaymentInput = {
  tenantId: number;
  studentId: number;
  amount: number;
  paymentDate: string;
  paymentMethod: string | null;
  paymentAccountId: number | null;
  termLabel: string | null;
  notes: string | null;
  receiptNumber: string;
  createdByUserId: number;
};

export type RecordLedgerPaymentResult = {
  payment: Record<string, unknown>;
  receiptSnapshot: ReturnType<typeof buildReceiptSnapshot>;
  allocation: ReturnType<typeof allocatePayment>;
  balance: {
    termFee: number;
    arrears: number;
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    credit: number;
    status: string;
  };
};

/**
 * Validates term matches active term and posts payment + ledger credit in one transaction.
 */
export async function recordPaymentWithLedger(
  input: RecordLedgerPaymentInput
): Promise<RecordLedgerPaymentResult> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const ctx = await getCurrentTermPaymentContext(client, input.tenantId, input.studentId);
    if (!ctx) {
      throw new Error('No active term configured. Set the current term in School Settings first.');
    }

    if (input.termLabel) {
      const normalized = input.termLabel.trim().toLowerCase();
      const activeNorm = ctx.termLabel.trim().toLowerCase();
      if (normalized !== activeNorm && !activeNorm.includes(normalized) && !normalized.includes(activeNorm)) {
        throw new Error(`Payment term must match the active term (${ctx.termLabel}).`);
      }
    }

    const allocation = allocatePayment(ctx, input.amount);
    const receiptSnapshot = buildReceiptSnapshot(allocation);

    const termToStore = input.termLabel?.trim() || ctx.termLabel;

    let insertResult;
    try {
      insertResult = await client.query(
        `INSERT INTO payments (tenant_id, student_id, amount, payment_date, payment_method, payment_account_id, term, notes, receipt_number, base_receipt_number, receipt_snapshot)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10::jsonb) RETURNING *`,
        [
          input.tenantId,
          input.studentId,
          input.amount,
          input.paymentDate,
          input.paymentMethod,
          input.paymentAccountId,
          termToStore,
          input.notes,
          input.receiptNumber,
          JSON.stringify(receiptSnapshot),
        ]
      );
    } catch {
      insertResult = await client.query(
        `INSERT INTO payments (tenant_id, student_id, amount, payment_date, payment_method, payment_account_id, term, notes, receipt_number, base_receipt_number)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) RETURNING *`,
        [
          input.tenantId,
          input.studentId,
          input.amount,
          input.paymentDate,
          input.paymentMethod,
          input.paymentAccountId,
          termToStore,
          input.notes,
          input.receiptNumber,
        ]
      );
      await client.query(
        `UPDATE payments SET receipt_snapshot = $1::jsonb WHERE id = $2 AND tenant_id = $3`,
        [JSON.stringify(receiptSnapshot), insertResult.rows[0].id, input.tenantId]
      );
    }

    const payment = insertResult.rows[0];
    const paymentId = Number(payment.id);

    // Insert ledger entries according to allocation: current term first, then arrears (oldest first), then any residual credit
    let remainingToAllocate = roundMoney(input.amount);

    // 1) current term portion
    if (allocation.termFeeCleared > 0) {
      await client.query(
        `INSERT INTO student_ledger (
           tenant_id, student_id, academic_year_id, term_id, description, entry_type,
           debit, credit, payment_method, receipt_number, reference, payment_id, created_by, metadata
         ) VALUES ($1, $2, $3, $4, $5, 'payment', 0, $6, $7, $8, $8, $9, $10, $11::jsonb)`,
        [
          input.tenantId,
          input.studentId,
          ctx.academicYearId,
          ctx.ledgerTermId,
          `Payment recorded — Receipt #${input.receiptNumber} (term portion)`,
          allocation.termFeeCleared,
          input.paymentMethod,
          input.receiptNumber,
          paymentId,
          input.createdByUserId,
          JSON.stringify({ allocation: receiptSnapshot, portion: 'term', amount: allocation.termFeeCleared }),
        ]
      );
      remainingToAllocate = roundMoney(remainingToAllocate - allocation.termFeeCleared);
    }

    // 2) apply to prior-term arrears (oldest first)
    if (allocation.arrearsCleared > 0) {
      const full = await getStudentFullBalance(client, input.tenantId, input.studentId);
      const prior = full?.priorTerms ?? [];
      let toClear = allocation.arrearsCleared;
      for (const pt of prior) {
        if (toClear <= 0) break;
        const termOutstanding = pt.outstanding > 0 ? pt.outstanding : 0;
        if (termOutstanding <= 0) continue;
        const applyAmt = roundMoney(Math.min(termOutstanding, toClear));
        if (applyAmt <= 0) continue;
        await client.query(
          `INSERT INTO student_ledger (
             tenant_id, student_id, academic_year_id, term_id, description, entry_type,
             debit, credit, payment_method, receipt_number, reference, payment_id, created_by, metadata
           ) VALUES ($1, $2, $3, $4, $5, 'payment', 0, $6, $7, $8, $8, $9, $10, $11::jsonb)`,
          [
            input.tenantId,
            input.studentId,
            // find academic year id for this prior term by resolving ledger term
            pt.termId ? (await resolveActiveLedgerTerm(client.query.bind(client), input.tenantId, pt.termId)).academicYearId : ctx.academicYearId,
            pt.termId,
            `Payment recorded — Receipt #${input.receiptNumber} (arrears)`,
            applyAmt,
            input.paymentMethod,
            input.receiptNumber,
            paymentId,
            input.createdByUserId,
            JSON.stringify({ allocation: receiptSnapshot, portion: 'arrears', amount: applyAmt, targetTerm: pt.termId }),
          ]
        );
        toClear = roundMoney(toClear - applyAmt);
        remainingToAllocate = roundMoney(remainingToAllocate - applyAmt);
      }
    }

    // 3) any residual (overpayment) -> credit in current term
    if (remainingToAllocate > 0.001) {
      await client.query(
        `INSERT INTO student_ledger (
           tenant_id, student_id, academic_year_id, term_id, description, entry_type,
           debit, credit, payment_method, receipt_number, reference, payment_id, created_by, metadata
         ) VALUES ($1, $2, $3, $4, $5, 'payment', 0, $6, $7, $8, $8, $9, $10, $11::jsonb)`,
        [
          input.tenantId,
          input.studentId,
          ctx.academicYearId,
          ctx.ledgerTermId,
          `Payment recorded — Receipt #${input.receiptNumber} (credit)`,
          remainingToAllocate,
          input.paymentMethod,
          input.receiptNumber,
          paymentId,
          input.createdByUserId,
          JSON.stringify({ allocation: receiptSnapshot, portion: 'credit', amount: remainingToAllocate }),
        ]
      );
    }

    await client.query('COMMIT');

    return {
      payment: { ...payment, receipt_snapshot: receiptSnapshot },
      receiptSnapshot,
      allocation,
      balance: {
        termFee: allocation.termFee,
        arrears: allocation.arrears,
        totalDue: allocation.totalDue,
        totalPaid: receiptSnapshot.totalPaidThisTerm ?? allocation.totalPaidBefore + input.amount,
        outstanding: allocation.outstandingAfter,
        credit: allocation.credit,
        status: allocation.status,
      },
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Post term fee when a student becomes active (pending approval or reactivation). */
export type ActivationFeeResult = {
  posted: boolean;
  amount: number;
  skippedReason?: 'already_billed' | 'no_active_term' | 'no_class' | 'no_fee_structure';
  termName?: string;
  className?: string;
  message?: string;
};

export async function postStudentActivationTermFee(
  client: pg.PoolClient,
  tenantId: number,
  studentId: number,
  createdByUserId?: number,
  reason: 'enrollment' | 'reactivation' = 'enrollment'
): Promise<ActivationFeeResult> {
  const studentRes = await client.query(
    `SELECT s.class_assigned_id, c.class_name,
            s.is_beneficiary, s.discount_type, s.discount_value
     FROM students s
     LEFT JOIN classes c ON c.id = s.class_assigned_id
     WHERE s.id = $1 AND s.tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) {
    return { posted: false, amount: 0, skippedReason: 'no_class', message: 'Student not found.' };
  }
  const student = studentRes.rows[0];
  const classId = student.class_assigned_id != null ? Number(student.class_assigned_id) : null;
  const className = student.class_name ? String(student.class_name) : null;

  if (!classId) {
    return {
      posted: false,
      amount: 0,
      skippedReason: 'no_class',
      message: 'Student has no class assigned. Assign a class to bill fees.',
    };
  }

  const settingsRes = await client.query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term;
  const currentYear = settingsRes.rows[0]?.current_year;
  if (!currentTerm || !currentYear) {
    return {
      posted: false,
      amount: 0,
      skippedReason: 'no_active_term',
      message: 'No active term configured in school settings.',
    };
  }

  const resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
  if (!resolved) {
    return {
      posted: false,
      amount: 0,
      skippedReason: 'no_active_term',
      message: 'Could not resolve the active ledger term.',
    };
  }

  const { academicYearId, termId } = resolved;

  const existing = await client.query(
    `SELECT id FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND entry_type = 'term_fee'`,
    [tenantId, studentId, termId]
  );
  if (existing.rows.length > 0) {
    return { posted: false, amount: 0, skippedReason: 'already_billed' };
  }

  const feeRes = await client.query(
    `SELECT total FROM ledger_fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND academic_year_id = $3 AND term_id = $4`,
    [tenantId, classId, academicYearId, termId]
  );
  const termNameRes = await client.query(`SELECT name FROM terms WHERE id = $1`, [termId]);
  const termName = termNameRes.rows[0]?.name || String(currentTerm);
  const termLabel = `${termName} ${currentYear}`.trim();

  if (feeRes.rows.length === 0) {
    return {
      posted: false,
      amount: 0,
      skippedReason: 'no_fee_structure',
      termName: termLabel,
      className: className || undefined,
      message: className
        ? `No fee structure set for ${className} in ${termLabel}.`
        : `No fee structure set for the current term (${termLabel}).`,
    };
  }

  const { beneficiaryAdjustedFee } = await import('../utils/beneficiaryFee.js');
  const { totalFees: feeAmount } = beneficiaryAdjustedFee(parseFloat(feeRes.rows[0].total), student);

  const description =
    reason === 'reactivation'
      ? `Term fee posted on reactivation — ${termLabel}`
      : `Term fee — enrolled mid-term ${new Date().toISOString().slice(0, 10)}`;

  await client.query(
    `INSERT INTO student_ledger (
       tenant_id, student_id, academic_year_id, term_id, description, entry_type,
       debit, credit, created_by, metadata
     ) VALUES ($1, $2, $3, $4, $5, 'term_fee', $6, 0, $7, $8::jsonb)`,
    [
      tenantId,
      studentId,
      academicYearId,
      termId,
      description,
      feeAmount,
      createdByUserId ?? null,
      JSON.stringify({
        reason,
        reactivated_at: reason === 'reactivation' ? new Date().toISOString() : undefined,
        enrolledMidTerm: reason === 'enrollment',
        classId,
        termLabel,
      }),
    ]
  );

  return { posted: true, amount: feeAmount, termName: termLabel, className: className || undefined };
}

/** @deprecated Use postStudentActivationTermFee — class must already be assigned on the student row. */
export async function postMidTermEnrollmentFee(
  client: pg.PoolClient,
  tenantId: number,
  studentId: number,
  _classId: number,
  createdByUserId?: number
): Promise<{ posted: boolean; amount: number }> {
  const result = await postStudentActivationTermFee(client, tenantId, studentId, createdByUserId, 'enrollment');
  return { posted: result.posted, amount: result.amount };
}

/** Write off arrears (admin) — posts manual_adjustment credit. */
export async function writeOffArrears(
  tenantId: number,
  studentId: number,
  writeOffAmount: number,
  reason: string,
  notes: string,
  adminUserId: number
): Promise<{ writtenOff: number; newOutstanding: number }> {
  if (writeOffAmount <= 0) throw new Error('Write-off amount must be greater than zero.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const ctx = await getCurrentTermPaymentContext(client, tenantId, studentId);
    if (!ctx) throw new Error('No active term configured.');

    const maxWriteOff = ctx.arrears > 0 ? ctx.arrears : ctx.outstandingBefore;
    if (writeOffAmount > maxWriteOff + 0.01) {
      throw new Error(`Write-off amount cannot exceed current arrears/outstanding (GHS ${maxWriteOff.toFixed(2)}).`);
    }

    await client.query(
      `INSERT INTO student_ledger (
         tenant_id, student_id, academic_year_id, term_id, description, entry_type,
         debit, credit, created_by, metadata, adjustment_category, adjustment_notes, created_by_user_id
       ) VALUES ($1, $2, $3, $4, $5, 'manual_adjustment', 0, $6, $7, $8::jsonb, $9, $10, $7)`,
      [
        tenantId,
        studentId,
        ctx.academicYearId,
        ctx.ledgerTermId,
        `Arrears write-off — ${reason}`,
        writeOffAmount,
        adminUserId,
        JSON.stringify({ reason, notes, writeOffAmount, type: 'ARREARS_WRITE_OFF' }),
        reason,
        notes,
      ]
    );

    const { getStudentFullBalance } = await import('./studentUnifiedBalanceService.js');
    const after = await getStudentFullBalance(client, tenantId, studentId);

    await client.query('COMMIT');
    return {
      writtenOff: writeOffAmount,
      newOutstanding: after?.outstanding ?? 0,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
