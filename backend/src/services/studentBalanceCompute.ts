/**
 * @deprecated Legacy balance engine — retained for migration/reference only.
 * All balance reads must use ledgerBalanceService.getStudentBalanceFromLedger().
 */
import { query } from '../db/connection.js';
import { calculateFeeBalance, SQL_ACTIVE_PAYMENT, SQL_PAYMENT_AMOUNT } from './financeCalculationService.js';
import { beneficiaryAdjustedFee } from '../utils/beneficiaryFee.js';

/** Resolve term string for matching fee_structures and payments */
export function resolveTermForMatch(term: string | null, academicYear: string | null): string | null {
  if (!term) return null;
  const t = String(term).trim();
  if (academicYear) {
    const y = String(academicYear).trim();
    if (!t.includes(y)) {
      return `${t} ${y}`;
    }
  }
  return t;
}

/** Calculate student fee balance (matches Fees module). */
export async function computeStudentBalance(
  tenantId: number,
  studentId: number,
  classId: number | null,
  term: string | null,
  academicYear: string | null
) {
  const termMatch = resolveTermForMatch(term, academicYear) || term;
  if (!termMatch || !classId) {
    return { ...calculateFeeBalance(0, 0), standardFees: 0, discountAmount: 0, totalFees: 0 };
  }

  const studentRes = await query(
    `SELECT is_beneficiary, discount_type, discount_value FROM students
     WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  const student = studentRes.rows[0];

  const feeRes = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM fee_structures
     WHERE tenant_id = $1 AND class_id = $2 AND (term = $3 OR term LIKE $4 OR $3 LIKE term || '%')`,
    [tenantId, classId, termMatch, `${termMatch}%`]
  );
  const standardFees = parseFloat(feeRes.rows[0]?.total || '0');
  const adjusted = beneficiaryAdjustedFee(standardFees, student);
  const totalFees = adjusted.totalFees;
  const discountAmount = adjusted.discountAmount;

  const paidRes = await query(
    `SELECT COALESCE(SUM(${SQL_PAYMENT_AMOUNT}), 0) as total FROM payments
     WHERE tenant_id = $1 AND student_id = $2
       AND (term = $3 OR term LIKE $4 OR $3 LIKE term || '%')
       AND ${SQL_ACTIVE_PAYMENT}`,
    [tenantId, studentId, termMatch, `${termMatch}%`]
  );
  const totalPaid = parseFloat(paidRes.rows[0]?.total || '0');

  const arrearsRes = await query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM term_arrears
     WHERE tenant_id = $1 AND student_id = $2
       AND (current_term = $3 OR current_term LIKE $4 OR $3 LIKE current_term || '%')`,
    [tenantId, studentId, termMatch, `${termMatch}%`]
  );
  const arrears = Math.max(0, parseFloat(arrearsRes.rows[0]?.total || '0'));

  const balance = calculateFeeBalance(totalFees, totalPaid, arrears);
  return {
    ...balance,
    totalFees,
    standardFees,
    discountAmount,
  };
}

export async function collectStudentFeeTerms(
  tenantId: number,
  studentId: number,
  classId: number | null,
  currentTerm: string | null,
  currentYear: string | null
): Promise<string[]> {
  const terms = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const v = String(raw || '').trim();
    if (v) terms.add(v);
  };

  if (classId) {
    const fs = await query(
      `SELECT DISTINCT TRIM(term) AS term FROM fee_structures
       WHERE tenant_id = $1 AND class_id = $2 AND term IS NOT NULL AND TRIM(term) <> ''`,
      [tenantId, classId]
    );
    fs.rows.forEach((r: { term: string }) => add(r.term));
  }

  const pay = await query(
    `SELECT DISTINCT TRIM(term) AS term FROM payments
     WHERE tenant_id = $1 AND student_id = $2 AND term IS NOT NULL AND TRIM(term) <> ''`,
    [tenantId, studentId]
  );
  pay.rows.forEach((r: { term: string }) => add(r.term));

  const arr = await query(
    `SELECT DISTINCT TRIM(current_term) AS term FROM term_arrears
     WHERE tenant_id = $1 AND student_id = $2 AND current_term IS NOT NULL AND TRIM(current_term) <> ''`,
    [tenantId, studentId]
  );
  arr.rows.forEach((r: { term: string }) => add(r.term));

  if (currentTerm) {
    add(currentTerm);
    add(resolveTermForMatch(currentTerm, currentYear));
  }

  return Array.from(terms).sort((a, b) => b.localeCompare(a));
}
