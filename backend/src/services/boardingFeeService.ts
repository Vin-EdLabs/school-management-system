import { query } from '../db/connection.js';
import { getIO } from '../socket.js';
import { getStudentBalanceFromLedger } from './ledgerBalanceService.js';
import { notifyTenantStaffByRoles } from './staffNotificationService.js';
import {
  upsertBoardingFeeRecord,
  voidBoardingFeeRecords,
  syncBoardingFeeRecordPaymentStatus,
  logBoardingFeeAudit,
} from './boardingFeeRecordService.js';

export const BOARDING_LODGING_LABEL = 'Boarding — Lodging';
export const BOARDING_FEEDING_LABEL = 'Boarding — Feeding';
export const BOARDING_LEDGER_SOURCE = 'boarding';

export type BoardingFeeMode = 'same' | 'by_gender';

export type BoardingTermFeeRow = {
  term_id: number;
  lodging_amount: number;
  feeding_amount: number;
  amount: number;
  is_active: boolean;
  fee_mode: BoardingFeeMode;
  boys_lodging_amount: number;
  boys_feeding_amount: number;
  girls_lodging_amount: number;
  girls_feeding_amount: number;
};

export type BoardingFeeBreakdown = {
  lodging: number;
  feeding: number;
  total: number;
};

export type ApplyBoardingFeeResult = {
  ok: boolean;
  applied: boolean;
  skipped: boolean;
  reason?: 'not_configured' | 'inactive' | 'zero_amount' | 'already_applied' | 'student_not_found';
  amount: number;
  breakdown: BoardingFeeBreakdown;
  message?: string;
};

export type RemoveBoardingFeeResult = {
  ok: boolean;
  removed: boolean;
  flaggedForReview: boolean;
  paidPortion: number;
  unpaidPortion: number;
  breakdown: BoardingFeeBreakdown;
  message?: string;
};

export type SyncBoardingFeesResult = {
  termId: number;
  applied: number;
  removed: number;
  flagged: number;
  skipped: number;
  warnings: string[];
  details: Array<{
    studentId: number;
    action: 'applied' | 'removed' | 'flagged' | 'skipped';
    message: string;
  }>;
};

function emitFeeChanged(tenantId: number) {
  try {
    getIO().to(`tenant:${tenantId}`).emit('tenant-data-changed', {
      tenantId,
      entity: 'fee',
      action: 'updated',
      at: Date.now(),
    });
  } catch {
    /* noop */
  }
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseBoardingTermFeeRow(termId: number, row: Record<string, unknown>): BoardingTermFeeRow {
  const lodging = roundMoney(Number(row.lodging_amount) || 0);
  const feeding = roundMoney(Number(row.feeding_amount) || 0);
  const legacyAmount = roundMoney(Number(row.amount) || 0);
  const total = lodging + feeding > 0 ? roundMoney(lodging + feeding) : legacyAmount;
  const feeMode = String(row.fee_mode || 'same') === 'by_gender' ? 'by_gender' : 'same';
  return {
    term_id: termId,
    lodging_amount: lodging > 0 ? lodging : legacyAmount,
    feeding_amount: feeding,
    amount: total,
    is_active: Boolean(row.is_active),
    fee_mode: feeMode,
    boys_lodging_amount: roundMoney(Number(row.boys_lodging_amount) || 0),
    boys_feeding_amount: roundMoney(Number(row.boys_feeding_amount) || 0),
    girls_lodging_amount: roundMoney(Number(row.girls_lodging_amount) || 0),
    girls_feeding_amount: roundMoney(Number(row.girls_feeding_amount) || 0),
  };
}

export async function getBoardingTermFee(
  tenantId: number,
  termId: number
): Promise<BoardingTermFeeRow | null> {
  const result = await query(
    `SELECT lodging_amount, feeding_amount, amount, is_active,
            fee_mode, boys_lodging_amount, boys_feeding_amount,
            girls_lodging_amount, girls_feeding_amount
     FROM boarding_term_fees
     WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, termId]
  );
  if (result.rows.length === 0) return null;
  return parseBoardingTermFeeRow(termId, result.rows[0]);
}

/** Resolve lodging/feeding amounts for a specific student (gender-aware). */
export async function getBoardingFeeBreakdownForStudent(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<BoardingFeeBreakdown & { fee_mode: BoardingFeeMode }> {
  const config = await getBoardingTermFee(tenantId, termId);
  if (!config || !config.is_active) {
    return { lodging: 0, feeding: 0, total: 0, fee_mode: 'same' };
  }

  if (config.fee_mode !== 'by_gender') {
    return {
      lodging: config.lodging_amount,
      feeding: config.feeding_amount,
      total: config.amount,
      fee_mode: 'same',
    };
  }

  const studentRes = await query(
    `SELECT LOWER(TRIM(COALESCE(gender, ''))) AS gender FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  const gender = String(studentRes.rows[0]?.gender || '');
  const isFemale = gender === 'female' || gender === 'f';
  const lodging = isFemale ? config.girls_lodging_amount : config.boys_lodging_amount;
  const feeding = isFemale ? config.girls_feeding_amount : config.boys_feeding_amount;
  return {
    lodging,
    feeding,
    total: roundMoney(lodging + feeding),
    fee_mode: 'by_gender',
  };
}

export async function getBoardingFeeAmountForStudent(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<number> {
  const breakdown = await getBoardingFeeBreakdownForStudent(tenantId, studentId, termId);
  return breakdown.total;
}

export type UpsertBoardingTermFeeInput = {
  lodgingAmount: number;
  feedingAmount: number;
  isActive?: boolean;
  feeMode?: BoardingFeeMode;
  boysLodgingAmount?: number;
  boysFeedingAmount?: number;
  girlsLodgingAmount?: number;
  girlsFeedingAmount?: number;
};

export async function upsertBoardingTermFee(
  tenantId: number,
  termId: number,
  lodgingAmount: number,
  feedingAmount: number,
  isActive = true,
  genderOpts?: Omit<UpsertBoardingTermFeeInput, 'lodgingAmount' | 'feedingAmount' | 'isActive'>
): Promise<BoardingTermFeeRow> {
  const lodging = roundMoney(Math.max(0, lodgingAmount));
  const feeding = roundMoney(Math.max(0, feedingAmount));
  const total = roundMoney(lodging + feeding);
  const feeMode = genderOpts?.feeMode === 'by_gender' ? 'by_gender' : 'same';
  const boysLodging = roundMoney(Math.max(0, genderOpts?.boysLodgingAmount ?? 0));
  const boysFeeding = roundMoney(Math.max(0, genderOpts?.boysFeedingAmount ?? 0));
  const girlsLodging = roundMoney(Math.max(0, genderOpts?.girlsLodgingAmount ?? 0));
  const girlsFeeding = roundMoney(Math.max(0, genderOpts?.girlsFeedingAmount ?? 0));
  const result = await query(
    `INSERT INTO boarding_term_fees (
       tenant_id, term_id, lodging_amount, feeding_amount, amount, is_active,
       fee_mode, boys_lodging_amount, boys_feeding_amount, girls_lodging_amount, girls_feeding_amount,
       updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP)
     ON CONFLICT (tenant_id, term_id)
     DO UPDATE SET
       lodging_amount = EXCLUDED.lodging_amount,
       feeding_amount = EXCLUDED.feeding_amount,
       amount = EXCLUDED.amount,
       is_active = EXCLUDED.is_active,
       fee_mode = EXCLUDED.fee_mode,
       boys_lodging_amount = EXCLUDED.boys_lodging_amount,
       boys_feeding_amount = EXCLUDED.boys_feeding_amount,
       girls_lodging_amount = EXCLUDED.girls_lodging_amount,
       girls_feeding_amount = EXCLUDED.girls_feeding_amount,
       updated_at = CURRENT_TIMESTAMP
     RETURNING term_id, lodging_amount, feeding_amount, amount, is_active,
               fee_mode, boys_lodging_amount, boys_feeding_amount, girls_lodging_amount, girls_feeding_amount`,
    [
      tenantId,
      termId,
      lodging,
      feeding,
      total,
      isActive,
      feeMode,
      boysLodging,
      boysFeeding,
      girlsLodging,
      girlsFeeding,
    ]
  );
  return parseBoardingTermFeeRow(termId, result.rows[0]);
}

/** Net boarding debits applied on the student ledger for a term. */
export async function getAppliedBoardingFeeBreakdown(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<BoardingFeeBreakdown> {
  const res = await query(
    `SELECT
       COALESCE(SUM(CASE
         WHEN entry_type = 'boarding_fee' THEN debit
         WHEN entry_type = 'boarding_fee_void' THEN -credit
         ELSE 0
       END), 0)::numeric AS lodging,
       COALESCE(SUM(CASE
         WHEN entry_type = 'boarding_feeding' THEN debit
         WHEN entry_type = 'boarding_feeding_void' THEN -credit
         ELSE 0
       END), 0)::numeric AS feeding
     FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
       AND entry_type IN (
         'boarding_fee', 'boarding_fee_void',
         'boarding_feeding', 'boarding_feeding_void'
       )`,
    [tenantId, studentId, termId]
  );
  const lodging = roundMoney(parseFloat(String(res.rows[0]?.lodging)) || 0);
  const feeding = roundMoney(parseFloat(String(res.rows[0]?.feeding)) || 0);
  return { lodging, feeding, total: roundMoney(lodging + feeding) };
}

/** Estimate how much of the boarding fee has been covered by term payments. */
export async function computeBoardingPaidPortion(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<{ paidPortion: number; unpaidPortion: number; boardingTotal: number }> {
  const balance = await getStudentBalanceFromLedger(null, tenantId, studentId, termId);
  const boarding = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);
  const boardingTotal = boarding.total;
  if (boardingTotal <= 0) {
    return { paidPortion: 0, unpaidPortion: 0, boardingTotal: 0 };
  }

  const totalDue = balance.totalDue;
  const totalPaid = balance.paymentsMade;
  const nonBoardingDue = roundMoney(Math.max(0, totalDue - boardingTotal));
  const paidPortion = roundMoney(Math.max(0, Math.min(boardingTotal, totalPaid - nonBoardingDue)));
  const unpaidPortion = roundMoney(Math.max(0, boardingTotal - paidPortion));
  return { paidPortion, unpaidPortion, boardingTotal };
}

async function upsertBoardingLedgerLine(
  tenantId: number,
  studentId: number,
  termId: number,
  academicYearId: number | null,
  entryType: string,
  description: string,
  amount: number
): Promise<'created' | 'updated' | 'unchanged'> {
  if (amount <= 0) return 'unchanged';

  const existing = await query(
    `SELECT id, debit FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND entry_type = $4
     LIMIT 1`,
    [tenantId, studentId, termId, entryType]
  );

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const current = roundMoney(Number(row.debit) || 0);
    if (Math.abs(current - amount) > 0.001) {
      await query(
        `UPDATE student_ledger
         SET debit = $1, description = $2, metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $4`,
        [amount, description, JSON.stringify({ source: BOARDING_LEDGER_SOURCE }), row.id]
      );
      return 'updated';
    }
    return 'unchanged';
  }

  await query(
    `INSERT INTO student_ledger (
       tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8::jsonb)`,
    [
      tenantId,
      studentId,
      academicYearId,
      termId,
      description,
      amount,
      entryType,
      JSON.stringify({ source: BOARDING_LEDGER_SOURCE }),
    ]
  );
  return 'created';
}

async function voidBoardingLedgerLine(
  tenantId: number,
  studentId: number,
  termId: number,
  academicYearId: number | null,
  entryType: string,
  voidEntryType: string,
  voidDescription: string
): Promise<boolean> {
  const ledgerRes = await query(
    `SELECT id, debit FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND entry_type = $4
     ORDER BY id DESC LIMIT 1`,
    [tenantId, studentId, termId, entryType]
  );
  if (ledgerRes.rows.length === 0) return false;

  const row = ledgerRes.rows[0];
  const amount = Number(row.debit || 0);
  await query(`DELETE FROM student_ledger WHERE id = $1`, [row.id]);
  if (amount > 0) {
    await query(
      `INSERT INTO student_ledger (
         tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, metadata
       )
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7, $8::jsonb)`,
      [
        tenantId,
        studentId,
        academicYearId,
        termId,
        voidDescription,
        amount,
        voidEntryType,
        JSON.stringify({ source: BOARDING_LEDGER_SOURCE, voided: true }),
      ]
    );
  }
  return true;
}

/**
 * Apply boarding fee lines to a student's ledger for a term.
 * Uses student_ledger (source=boarding) — ScholarNerve's fee statement store.
 */
export async function applyBoardingFeeToStudent(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<ApplyBoardingFeeResult> {
  const studentRes = await query(
    `SELECT id, first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) {
    return {
      ok: false,
      applied: false,
      skipped: true,
      reason: 'student_not_found',
      amount: 0,
      breakdown: { lodging: 0, feeding: 0, total: 0 },
      message: 'Student not found',
    };
  }

  const config = await getBoardingTermFee(tenantId, termId);
  if (!config) {
    return {
      ok: true,
      applied: false,
      skipped: true,
      reason: 'not_configured',
      amount: 0,
      breakdown: { lodging: 0, feeding: 0, total: 0 },
      message: 'No boarding fee configured for this term. Go to Fee Setup to add one.',
    };
  }
  if (!config.is_active) {
    return {
      ok: true,
      applied: false,
      skipped: true,
      reason: 'inactive',
      amount: 0,
      breakdown: { lodging: 0, feeding: 0, total: 0 },
      message: 'Boarding fee is inactive for this term.',
    };
  }

  const studentBreakdown = await getBoardingFeeBreakdownForStudent(tenantId, studentId, termId);
  if (studentBreakdown.total <= 0) {
    return {
      ok: true,
      applied: false,
      skipped: true,
      reason: 'zero_amount',
      amount: 0,
      breakdown: { lodging: 0, feeding: 0, total: 0 },
      message: 'Boarding fee amount is zero.',
    };
  }

  const termRes = await query(`SELECT academic_year_id FROM terms WHERE id = $1`, [termId]);
  const academicYearId = termRes.rows[0]?.academic_year_id ?? null;

  const before = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);

  const lodgingResult = await upsertBoardingLedgerLine(
    tenantId,
    studentId,
    termId,
    academicYearId,
    'boarding_fee',
    BOARDING_LODGING_LABEL,
    studentBreakdown.lodging
  );
  const feedingResult = await upsertBoardingLedgerLine(
    tenantId,
    studentId,
    termId,
    academicYearId,
    'boarding_feeding',
    BOARDING_FEEDING_LABEL,
    studentBreakdown.feeding
  );

  if (studentBreakdown.lodging > 0) {
    await upsertBoardingFeeRecord({
      tenantId,
      studentId,
      termId,
      feeCategory: 'boarding_lodging',
      description: BOARDING_LODGING_LABEL,
      amount: studentBreakdown.lodging,
      triggeredBy: 'boarding_enrollment',
    });
  }
  if (studentBreakdown.feeding > 0) {
    await upsertBoardingFeeRecord({
      tenantId,
      studentId,
      termId,
      feeCategory: 'boarding_feeding',
      description: BOARDING_FEEDING_LABEL,
      amount: studentBreakdown.feeding,
      triggeredBy: 'boarding_enrollment',
    });
  }
  await syncBoardingFeeRecordPaymentStatus(tenantId, studentId, termId);

  const after = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);
  const changed =
    lodgingResult === 'created' ||
    feedingResult === 'created' ||
    lodgingResult === 'updated' ||
    feedingResult === 'updated';

  if (changed) {
    emitFeeChanged(tenantId);
  }

  const studentName = `${studentRes.rows[0].first_name} ${studentRes.rows[0].last_name}`.trim();
  if (!changed && before.total >= studentBreakdown.total - 0.001) {
    return {
      ok: true,
      applied: false,
      skipped: true,
      reason: 'already_applied',
      amount: after.total,
      breakdown: after,
      message: `Boarding fee already on ${studentName}'s statement.`,
    };
  }

  return {
    ok: true,
    applied: changed,
    skipped: !changed,
    amount: after.total,
    breakdown: after,
    message: changed
      ? `Boarding fee of GHS ${after.total.toFixed(2)} has been added to ${studentName}'s fee statement.`
      : undefined,
  };
}

/** @deprecated Use applyBoardingFeeToStudent */
export const applyBoardingFeeForStudent = async (
  tenantId: number,
  studentId: number,
  termId: number
): Promise<void> => {
  await applyBoardingFeeToStudent(tenantId, studentId, termId);
};

async function notifyBoardingFeePaidReview(
  tenantId: number,
  studentId: number,
  studentName: string,
  paidPortion: number
): Promise<void> {
  await notifyTenantStaffByRoles(tenantId, ['super-admin', 'administrator', 'finance'], {
    kind: 'admin',
    title: 'Boarding fee review required',
    message: `${studentName} was converted to a day student but has GHS ${paidPortion.toFixed(2)} in boarding fee payments. Please issue a refund or credit manually.`,
    url: `/students?highlight=${studentId}`,
    referenceKeyPrefix: `boarding-fee-paid-review:${tenantId}:${studentId}`,
  }).catch(() => undefined);
}

/**
 * Remove boarding fee from a student's ledger when they are no longer a boarder.
 * Paid/partially paid fees are flagged for admin review — never silently deleted.
 */
export async function removeBoardingFeeFromStudent(
  tenantId: number,
  studentId: number,
  termId: number,
  opts?: { studentName?: string; notifyAdmin?: boolean }
): Promise<RemoveBoardingFeeResult> {
  const applied = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);
  if (applied.total <= 0) {
    return {
      ok: true,
      removed: false,
      flaggedForReview: false,
      paidPortion: 0,
      unpaidPortion: 0,
      breakdown: applied,
      message: 'No boarding fee on statement.',
    };
  }

  const { paidPortion, unpaidPortion } = await computeBoardingPaidPortion(tenantId, studentId, termId);

  let studentName = opts?.studentName?.trim() || '';
  if (!studentName) {
    const studentRes = await query(
      `SELECT first_name, last_name FROM students WHERE id = $1 AND tenant_id = $2`,
      [studentId, tenantId]
    );
    studentName =
      studentRes.rows.length > 0
        ? `${studentRes.rows[0].first_name} ${studentRes.rows[0].last_name}`.trim()
        : 'Student';
  }

  if (paidPortion > 0.001 && unpaidPortion > 0.001) {
    await syncBoardingFeeRecordPaymentStatus(tenantId, studentId, termId);
    if (opts?.notifyAdmin !== false) {
      await notifyBoardingFeePaidReview(tenantId, studentId, studentName, paidPortion);
    }
    await logBoardingFeeAudit({
      tenantId,
      studentId,
      termId,
      action: 'flagged_partial',
      feeAmount: unpaidPortion,
      triggeredBy: 'day_conversion',
      metadata: { paidPortion, studentName },
    });
    return {
      ok: true,
      removed: false,
      flaggedForReview: true,
      paidPortion,
      unpaidPortion,
      breakdown: applied,
      message: `${studentName} has a partial boarding fee payment (GHS ${paidPortion.toFixed(2)} paid). Admin review required before removing the remaining balance.`,
    };
  }

  if (paidPortion > 0.001) {
    await syncBoardingFeeRecordPaymentStatus(tenantId, studentId, termId);
    await logBoardingFeeAudit({
      tenantId,
      studentId,
      termId,
      action: 'paid_preserved',
      feeAmount: paidPortion,
      triggeredBy: 'day_conversion',
      metadata: { studentName },
    });
    return {
      ok: true,
      removed: false,
      flaggedForReview: false,
      paidPortion,
      unpaidPortion: 0,
      breakdown: applied,
      message: `Paid boarding fee preserved for ${studentName}.`,
    };
  }

  const termRes = await query(`SELECT academic_year_id FROM terms WHERE id = $1`, [termId]);
  const academicYearId = termRes.rows[0]?.academic_year_id ?? null;

  await voidBoardingFeeRecords({
    tenantId,
    studentId,
    termId,
    triggeredBy: 'day_conversion',
  });

  await voidBoardingLedgerLine(
    tenantId,
    studentId,
    termId,
    academicYearId,
    'boarding_fee',
    'boarding_fee_void',
    'Boarding lodging voided (day student)'
  );
  await voidBoardingLedgerLine(
    tenantId,
    studentId,
    termId,
    academicYearId,
    'boarding_feeding',
    'boarding_feeding_void',
    'Boarding feeding voided (day student)'
  );
  emitFeeChanged(tenantId);

  return {
    ok: true,
    removed: true,
    flaggedForReview: false,
    paidPortion: 0,
    unpaidPortion: applied.total,
    breakdown: { lodging: 0, feeding: 0, total: 0 },
    message: `Boarding fee removed from ${studentName}'s fee statement.`,
  };
}

/** @deprecated Use removeBoardingFeeFromStudent */
export const voidBoardingFeeForStudent = async (
  tenantId: number,
  studentId: number,
  termId: number
): Promise<void> => {
  await removeBoardingFeeFromStudent(tenantId, studentId, termId, { notifyAdmin: true });
};

/** Repair/sync boarding fees for all enrollments in a term. */
export async function syncAllBoardingFees(
  tenantId: number,
  termId: number
): Promise<SyncBoardingFeesResult> {
  const enrollments = await query(
    `SELECT be.student_id, be.status, s.first_name, s.last_name
     FROM boarding_enrollments be
     JOIN students s ON s.id = be.student_id
     WHERE be.tenant_id = $1 AND be.term_id = $2`,
    [tenantId, termId]
  );

  const result: SyncBoardingFeesResult = {
    termId,
    applied: 0,
    removed: 0,
    flagged: 0,
    skipped: 0,
    warnings: [],
    details: [],
  };

  const config = await getBoardingTermFee(tenantId, termId);
  if (!config || !config.is_active || config.amount <= 0) {
    result.warnings.push('No active boarding fee configured for this term.');
  }

  for (const row of enrollments.rows) {
    const studentId = Number(row.student_id);
    const studentName = `${row.first_name} ${row.last_name}`.trim();
    const status = String(row.status || 'day');

    if (status === 'boarder') {
      const applyResult = await applyBoardingFeeToStudent(tenantId, studentId, termId);
      if (applyResult.applied) {
        result.applied++;
        result.details.push({
          studentId,
          action: 'applied',
          message: applyResult.message || `Applied boarding fee for ${studentName}`,
        });
      } else if (applyResult.reason === 'not_configured') {
        result.skipped++;
        result.details.push({ studentId, action: 'skipped', message: applyResult.message || 'Not configured' });
        if (!result.warnings.includes(applyResult.message || '')) {
          result.warnings.push(applyResult.message || 'Boarding fee not configured');
        }
      } else {
        result.skipped++;
        result.details.push({
          studentId,
          action: 'skipped',
          message: applyResult.message || 'Already applied or skipped',
        });
      }
    } else {
      const removeResult = await removeBoardingFeeFromStudent(tenantId, studentId, termId, {
        studentName,
        notifyAdmin: false,
      });
      if (removeResult.removed) {
        result.removed++;
        result.details.push({
          studentId,
          action: 'removed',
          message: removeResult.message || `Removed boarding fee for ${studentName}`,
        });
      } else if (removeResult.flaggedForReview) {
        result.flagged++;
        result.details.push({
          studentId,
          action: 'flagged',
          message: removeResult.message || `Flagged ${studentName} for review`,
        });
      } else {
        result.skipped++;
        result.details.push({
          studentId,
          action: 'skipped',
          message: removeResult.message || 'Nothing to remove',
        });
      }
    }
  }

  if (result.flagged > 0) {
    result.warnings.push(`${result.flagged} student(s) have paid boarding fees and need admin review.`);
  }

  emitFeeChanged(tenantId);
  return result;
}

/**
 * If a student is an active boarder with a configured term fee but no ledger lines yet,
 * apply the boarding fee (repairs enroll-before-fee-config ordering).
 */
export async function ensureBoardingFeeSyncedForStudent(
  tenantId: number,
  studentId: number,
  termId: number
): Promise<void> {
  const { isBoardingEnabledForTenant } = await import('./boardingModuleService.js');
  if (!(await isBoardingEnabledForTenant(tenantId))) return;

  const applied = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);
  if (applied.total > 0) return;

  const enrollmentRes = await query(
    `SELECT id FROM boarding_enrollments
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND status = 'boarder'
     LIMIT 1`,
    [tenantId, studentId, termId]
  );
  if (enrollmentRes.rows.length === 0) return;

  const config = await getBoardingTermFee(tenantId, termId);
  if (!config?.is_active || config.amount <= 0) return;

  await applyBoardingFeeToStudent(tenantId, studentId, termId);
}

/**
 * Void all fully-unpaid boarding fees when boarding module is disabled.
 * Paid fees are permanent. Partial payments are flagged for admin review.
 */
export async function voidAllUnpaidBoardingFeesForTenant(
  tenantId: number,
  termId: number,
  performedBy?: number | null
): Promise<{ voided: number; flagged: number; preserved: number }> {
  const studentRes = await query(
    `SELECT DISTINCT student_id FROM (
       SELECT student_id FROM boarding_enrollments WHERE tenant_id = $1 AND term_id = $2
       UNION
       SELECT student_id FROM student_fee_records
       WHERE tenant_id = $1 AND term_id = $2 AND source = 'boarding' AND is_voided = FALSE
     ) s`,
    [tenantId, termId]
  );

  let voided = 0;
  let flagged = 0;
  let preserved = 0;

  for (const row of studentRes.rows) {
    const studentId = Number(row.student_id);
    const applied = await getAppliedBoardingFeeBreakdown(tenantId, studentId, termId);
    if (applied.total <= 0) continue;

    const result = await removeBoardingFeeFromStudent(tenantId, studentId, termId, {
      notifyAdmin: true,
    });

    if (result.removed) voided++;
    else if (result.flaggedForReview) flagged++;
    else if (result.paidPortion > 0) preserved++;
  }

  await logBoardingFeeAudit({
    tenantId,
    termId,
    action: 'bulk_void_unpaid',
    feeAmount: voided,
    triggeredBy: 'boarding_disabled',
    performedBy: performedBy ?? null,
    metadata: { voidedStudents: voided, flaggedPartial: flagged, preservedPaid: preserved },
  });

  emitFeeChanged(tenantId);
  return { voided, flagged, preserved };
}
