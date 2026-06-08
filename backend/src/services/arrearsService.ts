import { query } from '../db/connection.js';
import {
  beneficiaryAdjustedFee,
  isFullFeeWaiverStudentRow,
  type BeneficiaryStudentRow,
} from '../utils/beneficiaryFee.js';

export type TermYearNumbers = {
  yearNum: number;
  termNum: number;
};

/** Parse "Term 2" / "Term 2 2026" / settings year into comparable numbers. */
export function parseTermYearNumbers(term: string, year?: string | null): TermYearNumbers {
  const currentYearStr = String(year ?? term).trim();
  const yearStartMatch = currentYearStr.match(/^(\d{4})/);
  const yearFromTerm = String(term).match(/(\d{4})/);
  const yearNum =
    (yearStartMatch ? parseInt(yearStartMatch[1], 10) : null) ??
    (yearFromTerm ? parseInt(yearFromTerm[1], 10) : null) ??
    (parseInt(currentYearStr, 10) || new Date().getFullYear());
  const termNum = parseInt(String(term).match(/Term\s*(\d)/i)?.[1] || '1', 10);
  return { yearNum, termNum };
}

/** True when `termLabel` is strictly before the active term/year. */
export function isTermLabelBefore(
  termLabel: string,
  currentYearNum: number,
  currentTermNum: number
): boolean {
  const parsed = parseTermYearNumbers(termLabel);
  if (parsed.yearNum < currentYearNum) return true;
  if (parsed.yearNum > currentYearNum) return false;
  return parsed.termNum < currentTermNum;
}

function buildCurrentTermLabels(currentTerm: string, currentYear: string) {
  const termOnly = currentTerm.replace(/\s+\d{4}$/, '').trim();
  const fullTerm =
    currentYear && !currentTerm.includes(currentYear)
      ? `${currentTerm} ${currentYear}`.trim()
      : currentTerm;
  return { termOnly, fullTerm };
}

/** Ledger balance from all terms strictly before the active term. */
async function getLedgerBalanceBeforeCurrentTerm(
  tenantId: number,
  studentId: number,
  currentYearNum: number,
  currentTermNum: number
): Promise<number> {
  const ledgerResult = await query(
    `SELECT COALESCE(SUM(COALESCE(l.debit, 0) - COALESCE(l.credit, 0)), 0)::numeric AS balance
     FROM student_ledger l
     INNER JOIN terms lt ON lt.id = l.term_id AND lt.tenant_id = l.tenant_id
     INNER JOIN academic_years ay ON ay.id = lt.academic_year_id AND ay.tenant_id = l.tenant_id
     WHERE l.tenant_id = $1 AND l.student_id = $2
       AND (
         (CASE WHEN ay.name ~ '^[0-9]{4}' THEN substr(ay.name, 1, 4)::integer ELSE 0 END < $3)
         OR (
           (CASE WHEN ay.name ~ '^[0-9]{4}' THEN substr(ay.name, 1, 4)::integer ELSE 0 END = $3)
           AND COALESCE(NULLIF(regexp_replace(lt.name, '[^0-9]', '', 'g'), '')::integer, 0) < $4
         )
       )`,
    [tenantId, studentId, currentYearNum, currentTermNum]
  );
  return parseFloat(ledgerResult.rows[0]?.balance || '0') || 0;
}

/** Arrears debits posted in the current term (after carry-forward from a prior term). */
async function getCurrentTermArrearsLedgerAmount(
  tenantId: number,
  studentId: number,
  currentYearNum: number,
  currentTermNum: number
): Promise<number> {
  const result = await query(
    `SELECT COALESCE(SUM(COALESCE(l.debit, 0)), 0)::numeric AS amount
     FROM student_ledger l
     INNER JOIN terms lt ON lt.id = l.term_id AND lt.tenant_id = l.tenant_id
     INNER JOIN academic_years ay ON ay.id = lt.academic_year_id AND ay.tenant_id = l.tenant_id
     WHERE l.tenant_id = $1 AND l.student_id = $2 AND l.entry_type = 'arrears'
       AND (CASE WHEN ay.name ~ '^[0-9]{4}' THEN substr(ay.name, 1, 4)::integer ELSE 0 END = $3)
       AND COALESCE(NULLIF(regexp_replace(lt.name, '[^0-9]', '', 'g'), '')::integer, 0) = $4`,
    [tenantId, studentId, currentYearNum, currentTermNum]
  );
  return parseFloat(result.rows[0]?.amount || '0') || 0;
}

async function studentHasLedgerBeforeCurrentTerm(
  tenantId: number,
  studentId: number,
  currentYearNum: number,
  currentTermNum: number
): Promise<boolean> {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM student_ledger l
       INNER JOIN terms lt ON lt.id = l.term_id AND lt.tenant_id = l.tenant_id
       INNER JOIN academic_years ay ON ay.id = lt.academic_year_id AND ay.tenant_id = l.tenant_id
       WHERE l.tenant_id = $1 AND l.student_id = $2
         AND (
           (CASE WHEN ay.name ~ '^[0-9]{4}' THEN substr(ay.name, 1, 4)::integer ELSE 0 END < $3)
           OR (
             (CASE WHEN ay.name ~ '^[0-9]{4}' THEN substr(ay.name, 1, 4)::integer ELSE 0 END = $3)
             AND COALESCE(NULLIF(regexp_replace(lt.name, '[^0-9]', '', 'g'), '')::integer, 0) < $4
           )
         )
     ) AS has_history`,
    [tenantId, studentId, currentYearNum, currentTermNum]
  );
  return Boolean(result.rows[0]?.has_history);
}

/** Unpaid balances from fee_structures + payments for terms before the active term. */
async function getLegacyUnpaidBeforeCurrentTerm(
  tenantId: number,
  studentId: number,
  classId: number | null,
  beneficiary: BeneficiaryStudentRow | null,
  currentYearNum: number,
  currentTermNum: number
): Promise<number> {
  if (!classId) return 0;

  const termsRes = await query(
    `SELECT DISTINCT term FROM fee_structures WHERE tenant_id = $1 AND term IS NOT NULL AND TRIM(term) <> ''`,
    [tenantId]
  );

  let totalUnpaid = 0;
  for (const row of termsRes.rows) {
    const termLabel = String(row.term || '').trim();
    if (!termLabel || !isTermLabelBefore(termLabel, currentYearNum, currentTermNum)) continue;

    const termOnly = termLabel.replace(/\s+\d{4}$/, '').trim() || termLabel;
    const feeRes = await query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM fee_structures
       WHERE tenant_id = $1 AND class_id = $2
         AND (term = $3 OR term = $4 OR term ILIKE $5 OR term ILIKE $6)`,
      [tenantId, classId, termLabel, termOnly, `${termLabel}%`, `%${termOnly}%`]
    );
    const standardFees = parseFloat(feeRes.rows[0]?.total || '0') || 0;
    const adjusted = beneficiaryAdjustedFee(standardFees, beneficiary);

    const paidRes = await query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM payments
       WHERE tenant_id = $1 AND student_id = $2
         AND (term = $3 OR term = $4 OR term ILIKE $5 OR term ILIKE $6)`,
      [tenantId, studentId, termLabel, termOnly, `${termLabel}%`, `%${termOnly}%`]
    );
    const paid = parseFloat(paidRes.rows[0]?.total || '0') || 0;
    totalUnpaid += Math.max(0, adjusted.totalFees - paid);
  }

  return totalUnpaid;
}

/**
 * Single-student arrears for the active term.
 * Total payable = current term fee + this amount.
 */
export async function computeStudentArrearsAmount(
  tenantId: number,
  studentId: number,
  classId: number | null,
  beneficiary: BeneficiaryStudentRow | null,
  currentTerm: string,
  currentYear: string
): Promise<number> {
  const { yearNum, termNum } = parseTermYearNumbers(currentTerm, currentYear);

  const hasLedgerHistory = await studentHasLedgerBeforeCurrentTerm(
    tenantId,
    studentId,
    yearNum,
    termNum
  );
  const currentTermArrears = await getCurrentTermArrearsLedgerAmount(
    tenantId,
    studentId,
    yearNum,
    termNum
  );

  if (hasLedgerHistory || currentTermArrears > 0) {
    const ledgerPrev = await getLedgerBalanceBeforeCurrentTerm(
      tenantId,
      studentId,
      yearNum,
      termNum
    );
    return Math.max(0, Math.max(ledgerPrev, currentTermArrears));
  }

  const legacyUnpaid = await getLegacyUnpaidBeforeCurrentTerm(
    tenantId,
    studentId,
    classId,
    beneficiary,
    yearNum,
    termNum
  );
  return Math.max(0, legacyUnpaid);
}

/**
 * Recalculates and updates the term_arrears table for all students in a tenant.
 * Arrears are always stored as a non-negative amount (added to current term fees).
 */
export async function refreshArrearsForTenant(
  tenantId: number,
  overrideTerm?: string,
  overrideYear?: string
) {
  let current_term = overrideTerm;
  let current_year = overrideYear;

  if (!current_term || !current_year) {
    const settingsResult = await query(
      'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
      [tenantId]
    );
    if (settingsResult.rows.length === 0 || !settingsResult.rows[0].current_term) {
      throw new Error('Active term not set');
    }
    current_term = settingsResult.rows[0].current_term;
    current_year = settingsResult.rows[0].current_year;
  }

  if (!current_term || !current_year) throw new Error('Term and Year are required for sync');

  const { termOnly, fullTerm } = buildCurrentTermLabels(current_term, current_year);

  const studentsRes = await query(
    `SELECT id, class_assigned_id, is_beneficiary, discount_type, discount_value
     FROM students WHERE tenant_id = $1`,
    [tenantId]
  );

  let updatedCount = 0;
  for (const studentRow of studentsRes.rows) {
    const studentId = studentRow.id;
    const beneficiary: BeneficiaryStudentRow = {
      is_beneficiary: studentRow.is_beneficiary,
      discount_type: studentRow.discount_type,
      discount_value: studentRow.discount_value,
    };

    if (isFullFeeWaiverStudentRow(beneficiary)) {
      await query(
        `DELETE FROM term_arrears
         WHERE tenant_id = $1 AND student_id = $2
           AND (current_term = $3 OR current_term = $4 OR current_term = $5)`,
        [tenantId, studentId, fullTerm, current_term, termOnly]
      );
      continue;
    }

    const totalArrears = await computeStudentArrearsAmount(
      tenantId,
      studentId,
      studentRow.class_assigned_id,
      beneficiary,
      current_term,
      current_year
    );

    if (totalArrears > 0) {
      await query(
        `INSERT INTO term_arrears (tenant_id, student_id, current_term, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, student_id, current_term)
         DO UPDATE SET amount = EXCLUDED.amount, created_at = NOW()`,
        [tenantId, studentId, fullTerm, totalArrears]
      );
      updatedCount++;
    } else {
      await query(
        `DELETE FROM term_arrears
         WHERE tenant_id = $1 AND student_id = $2
           AND (current_term = $3 OR current_term = $4 OR current_term = $5)`,
        [tenantId, studentId, fullTerm, current_term, termOnly]
      );
    }
  }

  return { studentsUpdated: updatedCount, currentTerm: fullTerm };
}

/** Ledger unpaid per student for all terms strictly before `beforeTermId`. */
export async function getLedgerUnpaidBeforeTerm(
  tenantId: number,
  beforeTermId: number,
  beforeAcademicYearId: number
): Promise<Map<number, number>> {
  const result = await query(
    `SELECT sl.student_id,
            (COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(sl.credit), 0))::numeric AS balance
     FROM student_ledger sl
     INNER JOIN terms tt ON tt.id = sl.term_id
     WHERE sl.tenant_id = $1
       AND (tt.academic_year_id < $2 OR (tt.academic_year_id = $2 AND tt.id < $3))
     GROUP BY sl.student_id
     HAVING (COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(sl.credit), 0)) > 0`,
    [tenantId, beforeAcademicYearId, beforeTermId]
  );

  const map = new Map<number, number>();
  for (const row of result.rows) {
    map.set(Number(row.student_id), parseFloat(row.balance) || 0);
  }
  return map;
}

/** Legacy unpaid per student for terms before the active settings term (fee_structures + payments). */
export async function getLegacyUnpaidBeforeActiveTerm(
  tenantId: number,
  currentTerm: string,
  currentYear: string
): Promise<Map<number, number>> {
  const { yearNum, termNum } = parseTermYearNumbers(currentTerm, currentYear);
  const studentsRes = await query(
    `SELECT id, class_assigned_id, is_beneficiary, discount_type, discount_value
     FROM students WHERE tenant_id = $1 AND class_assigned_id IS NOT NULL`,
    [tenantId]
  );

  const map = new Map<number, number>();
  for (const student of studentsRes.rows) {
    const beneficiary: BeneficiaryStudentRow = {
      is_beneficiary: student.is_beneficiary,
      discount_type: student.discount_type,
      discount_value: student.discount_value,
    };
    if (isFullFeeWaiverStudentRow(beneficiary)) continue;

    const unpaid = await getLegacyUnpaidBeforeCurrentTerm(
      tenantId,
      student.id,
      student.class_assigned_id,
      beneficiary,
      yearNum,
      termNum
    );
    if (unpaid > 0) map.set(Number(student.id), unpaid);
  }
  return map;
}
