/**
 * @deprecated Legacy balance engine — retained for migration/reference only.
 * All balance reads must use studentUnifiedBalanceService or student_ledger directly.
 */
import type pg from 'pg';
import { query } from '../db/connection.js';
import { calculateFeeBalance, type FeeBalanceResult } from './financeCalculationService.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';
import { getStudentBalanceFromLedger } from './ledgerBalanceService.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

async function resolveTermIdForBalance(
  run: QueryFn,
  tenantId: number,
  term: string | null
): Promise<number | null> {
  if (!term?.trim()) {
    const settingsRes = await run(
      `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term;
    const currentYear = settingsRes.rows[0]?.current_year;
    if (!currentTerm || !currentYear) return null;
    const resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
    return resolved?.termId ?? null;
  }

  const termToStore = term.trim();
  const termOnly = termToStore.replace(/\s+\d{4}$/, '').trim() || termToStore;
  const termLookup = await run(
    `SELECT t.id
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1 AND (
       t.name = $2 OR t.name = $3 OR (t.name || ' ' || ay.name) = $2
     )
     LIMIT 1`,
    [tenantId, termToStore, termOnly]
  );
  if (termLookup.rows.length > 0) return Number(termLookup.rows[0].id);
  return null;
}

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

  const ledger = await query(
    `SELECT DISTINCT TRIM(t.name || ' ' || ay.name) AS term
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1 AND sl.student_id = $2`,
    [tenantId, studentId]
  );
  ledger.rows.forEach((r: { term: string }) => add(r.term));

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
    `SELECT COUNT(*)::int AS activity_count
     FROM student_ledger
     WHERE tenant_id = $1 AND student_id = $2 AND term_id IN (
       SELECT t.id FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1 AND (
         t.name = $3 OR t.name = $4 OR (t.name || ' ' || ay.name) = $3
       )
     )`,
    [tenantId, studentId, termMatch, termOnly]
  );
  return Number(res.rows[0]?.activity_count || 0) > 0;
}

/** @deprecated Use getStudentBalanceFromLedger — retained for FeeBalanceResult compatibility. */
export async function getStudentFeeBalance(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  term: string | null
): Promise<FeeBalanceResult | null> {
  const run = client ? client.query.bind(client) : query;
  const studentRes = await run(`SELECT id FROM students WHERE id = $1 AND tenant_id = $2`, [
    studentId,
    tenantId,
  ]);
  if (studentRes.rows.length === 0) return null;

  const termId = await resolveTermIdForBalance(run, tenantId, term);
  if (!termId) {
    return calculateFeeBalance(0, 0, 0);
  }

  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, termId);
  const result = calculateFeeBalance(balance.termFee, balance.totalPaid, balance.arrears);
  result.outstanding = balance.outstanding;
  result.credit = balance.creditBalance;
  if (balance.creditBalance > 0) {
    result.status = 'Credit';
  } else if (balance.outstanding > 0) {
    result.status = 'Owing';
  } else if (balance.termFee <= 0 && balance.totalPaid <= 0 && balance.arrears <= 0) {
    result.status = 'Cleared';
  } else {
    result.status = 'Cleared';
  }
  return result;
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
