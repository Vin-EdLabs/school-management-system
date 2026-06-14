import type pg from 'pg';
import { query } from '../db/connection.js';
import { calculateFeeBalance, type FeeBalanceResult } from './financeCalculationService.js';

type QueryFn = typeof query;

function resolveTermForMatch(term: string | null): string | null {
  return term ? String(term).trim() : null;
}

function applyBeneficiaryDiscount(
  rawTotal: number,
  student: { is_beneficiary?: boolean; discount_type?: string | null; discount_value?: number | null }
) {
  if (!student?.is_beneficiary) return rawTotal;
  const type = String(student.discount_type || '').toLowerCase().trim();
  const value = Number(student.discount_value) || 0;
  if (type === 'percentage') return rawTotal - (rawTotal * value) / 100;
  if (type === 'fixed') return Math.max(0, rawTotal - value);
  return rawTotal;
}

export function isGraduatedEnrollment(status: string | null | undefined): boolean {
  const s = String(status || 'active').toLowerCase().trim();
  return s === 'graduated' || s === 'alumni';
}

/** Active class, or last graduated class when alumni (class_assigned_id cleared). */
export async function resolveStudentClassId(
  run: QueryFn,
  tenantId: number,
  studentId: number,
  classAssignedId: number | null | undefined
): Promise<number | null> {
  if (classAssignedId != null && !Number.isNaN(Number(classAssignedId))) {
    return Number(classAssignedId);
  }
  const res = await run(
    `SELECT gd.class_id
     FROM graduation_details gd
     WHERE gd.tenant_id = $1 AND gd.student_id = $2
     ORDER BY gd.graduated_at DESC NULLS LAST, gd.id DESC
     LIMIT 1`,
    [tenantId, studentId]
  );
  const id = res.rows[0]?.class_id;
  return id != null ? Number(id) : null;
}

export async function collectStudentFinancialTerms(
  tenantId: number,
  studentId: number,
  currentTerm: string | null,
  currentYear: string | null
): Promise<string[]> {
  const terms = new Set<string>();
  const add = (raw: string | null | undefined) => {
    const v = String(raw || '').trim();
    if (v) terms.add(v);
  };

  const classId = await resolveStudentClassId(query, tenantId, studentId, null);
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
    if (currentYear && !currentTerm.includes(currentYear)) {
      add(`${currentTerm} ${currentYear}`.trim());
    }
  }

  return Array.from(terms).sort((a, b) => b.localeCompare(a));
}

async function termHasFinancialActivity(
  run: QueryFn,
  tenantId: number,
  studentId: number,
  termMatch: string,
  termOnly: string | null,
  termPred: (col: string) => string
): Promise<boolean> {
  const res = await run(
    `SELECT (
       (SELECT COUNT(*)::int FROM payments
        WHERE tenant_id = $1 AND student_id = $2 AND COALESCE(is_voided, false) = false
          AND ${termPred('term')})
       +
       (SELECT COUNT(*)::int FROM term_arrears
        WHERE tenant_id = $1 AND student_id = $2 AND ${termPred('current_term')})
     ) AS activity_count`,
    [tenantId, studentId, termMatch, termOnly]
  );
  return Number(res.rows[0]?.activity_count || 0) > 0;
}

/** Compute term fees, payments, and outstanding balance for a student (dynamic, not stored). */
export async function getStudentFeeBalance(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  term: string | null
): Promise<FeeBalanceResult | null> {
  const run = client ? client.query.bind(client) : query;
  const studentRes = await run(
    `SELECT class_assigned_id, enrollment_status, is_beneficiary, discount_type, discount_value
     FROM students WHERE id = $1 AND tenant_id = $2`,
    [studentId, tenantId]
  );
  if (studentRes.rows.length === 0) return null;
  const student = studentRes.rows[0];
  const isGraduated = isGraduatedEnrollment(student.enrollment_status);
  const classId = await resolveStudentClassId(run, tenantId, studentId, student.class_assigned_id);

  const termMatch = resolveTermForMatch(term);
  const termOnly = termMatch ? termMatch.split(/\s+/)[0] : null;

  const termPred = (col: string) =>
    termMatch
      ? `(${col} = $3 OR $3 LIKE ${col} || '%' OR ${col} LIKE $3 || '%' OR ${col} = $4 OR $4 LIKE ${col} || '%' OR ${col} LIKE $4 || '%')`
      : 'TRUE';

  let totalFees = 0;
  let applyFeeStructures = Boolean(classId && termMatch);
  if (applyFeeStructures && isGraduated) {
    applyFeeStructures = await termHasFinancialActivity(
      run,
      tenantId,
      studentId,
      termMatch!,
      termOnly,
      termPred
    );
  }

  if (applyFeeStructures && classId && termMatch) {
    const feeRes = await run(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_structures fs
       WHERE fs.tenant_id = $1 AND fs.class_id = $2
         AND (
           fs.term IS NULL OR TRIM(fs.term) = ''
           OR ${termPred('fs.term')}
         )`,
      [tenantId, classId, termMatch, termOnly]
    );
    totalFees = applyBeneficiaryDiscount(parseFloat(feeRes.rows[0]?.total || '0'), student);
  } else if (classId && !termMatch && !isGraduated) {
    const feeRes = await run(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM fee_structures
       WHERE tenant_id = $1 AND class_id = $2`,
      [tenantId, classId]
    );
    totalFees = applyBeneficiaryDiscount(parseFloat(feeRes.rows[0]?.total || '0'), student);
  }

  const paidParams: unknown[] = [tenantId, studentId];
  let paidWhere = 'tenant_id = $1 AND student_id = $2 AND COALESCE(is_voided, false) = false';
  if (termMatch) {
    paidWhere += ` AND ${termPred('term')}`;
    paidParams.push(termMatch, termOnly);
  }

  let totalPaid = 0;
  try {
    const paidRes = await run(
      `SELECT COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0) AS total FROM payments WHERE ${paidWhere}`,
      paidParams
    );
    totalPaid = parseFloat(paidRes.rows[0]?.total || '0');
  } catch {
    const paidRes = await run(
      `SELECT COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0) AS total FROM payments WHERE tenant_id = $1 AND student_id = $2 AND COALESCE(is_voided, false) = false`,
      [tenantId, studentId]
    );
    totalPaid = parseFloat(paidRes.rows[0]?.total || '0');
  }

  let arrears = 0;
  if (termMatch) {
    const arrearsRes = await run(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM term_arrears
       WHERE tenant_id = $1 AND student_id = $2 AND ${termPred('current_term')}`,
      [tenantId, studentId, termMatch, termOnly]
    );
    arrears = Math.max(0, parseFloat(arrearsRes.rows[0]?.total || '0'));
  } else {
    const arrearsRes = await run(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM term_arrears
       WHERE tenant_id = $1 AND student_id = $2`,
      [tenantId, studentId]
    );
    arrears = Math.max(0, parseFloat(arrearsRes.rows[0]?.total || '0'));
  }

  return calculateFeeBalance(totalFees, totalPaid, arrears);
}

/** Best outstanding snapshot — current term first, then highest across all known terms. */
export async function getStudentTotalOutstandingBalance(
  tenantId: number,
  studentId: number,
  currentTermLabel: string | null
): Promise<FeeBalanceResult | null> {
  let best: FeeBalanceResult | null = null;

  if (currentTermLabel) {
    best = await getStudentFeeBalance(null, tenantId, studentId, currentTermLabel);
  }

  const settingsRes = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term || null;
  const currentYear = settingsRes.rows[0]?.current_year || null;
  const terms = await collectStudentFinancialTerms(tenantId, studentId, currentTerm, currentYear);

  for (const term of terms) {
    const b = await getStudentFeeBalance(null, tenantId, studentId, term);
    if (!b) continue;
    if (!best || b.outstanding > best.outstanding) best = b;
  }

  return best;
}

export function buildReceiptSnapshot(balance: FeeBalanceResult): Record<string, number> {
  const totalFees = Number(balance.totalFees) || 0;
  const arrearsNum = Number(balance.arrears) || 0;
  const outstanding = Number(balance.outstanding);
  return {
    totalDue: totalFees + arrearsNum,
    termFee: totalFees,
    arrears: arrearsNum,
    balanceAfter: Math.max(0, Number.isFinite(outstanding) ? outstanding : 0),
    credit: Number(balance.credit) || 0,
  };
}
