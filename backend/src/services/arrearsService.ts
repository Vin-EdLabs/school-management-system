import { query } from '../db/connection.js';
import { isFullFeeWaiverStudentRow, sqlBeneficiaryAdjustedAmount } from '../utils/beneficiaryFee.js';

/**
 * Recalculates and updates the term_arrears table for all students in a tenant.
 * This function is the single source of truth for arrears calculation.
 * 
 * @param tenantId The tenant ID
 * @param overrideTerm Optional: Force sync for this specific term name (e.g. "Term 2")
 * @param overrideYear Optional: Force sync for this specific academic year (e.g. "2026")
 */
export async function refreshArrearsForTenant(tenantId: number, overrideTerm?: string, overrideYear?: string) {
  let current_term = overrideTerm;
  let current_year = overrideYear;

  // 1. Get current active term from settings if not overridden
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

  /** First calendar year in key (e.g. "2026/2027" → 2026); supports slash or single year. */
  const currentYearStr = String(current_year).trim();
  const yearStartMatch = currentYearStr.match(/^(\d{4})/);
  const currentYearNum = yearStartMatch ? parseInt(yearStartMatch[1], 10) : parseInt(currentYearStr, 10) || new Date().getFullYear();
  const currentTermNum = parseInt(current_term.match(/Term\s*(\d)/i)?.[1] || '1', 10);

  // Standardize current term strings for exclusion
  const termOnly = current_term.replace(/\s+\d{4}$/, '').trim();
  const fullTerm = (current_year && !current_term.includes(current_year))
    ? `${current_term} ${current_year}`.trim()
    : current_term;

  // 2. Fetch all academic terms for date mapping
  const termsRes = await query(
    'SELECT term_name, year, start_date, end_date FROM academic_terms WHERE tenant_id = $1',
    [tenantId]
  );
  const allTerms = termsRes.rows;

  // 3. Fetch all students to process
  const studentsRes = await query(
    `SELECT id, date_of_admission FROM students WHERE tenant_id = $1`,
    [tenantId]
  );

  const legacyFeeAmountSql = sqlBeneficiaryAdjustedAmount('fs.amount').trim();

  let updatedCount = 0;
  for (const studentRow of studentsRes.rows) {
    const studentId = studentRow.id;

    const beneficiaryRow = await query(
      `SELECT is_beneficiary, discount_type, discount_value FROM students WHERE id = $1 AND tenant_id = $2`,
      [studentId, tenantId]
    );
    const ben = beneficiaryRow.rows[0];
    if (isFullFeeWaiverStudentRow(ben)) {
      await query(
        `DELETE FROM term_arrears
         WHERE tenant_id = $1 AND student_id = $2 AND (current_term = $3 OR current_term = $4 OR current_term = $5)`,
        [tenantId, studentId, fullTerm, current_term, termOnly]
      );
      continue;
    }

    const legacyArrears = 0;

    // B. Calculate Ledger Arrears (from student_ledger)
    // ONLY include terms that are strictly BEFORE the current one
    // academic_terms.year may be "2026", "2026/2027", etc. — never cast whole string to int.
    const ledgerResult = await query(
      `SELECT SUM(COALESCE(debit, 0) - COALESCE(credit, 0)) as arrears 
       FROM student_ledger l
       LEFT JOIN academic_terms t ON l.term_id = t.id
       WHERE l.tenant_id = $1 AND l.student_id = $2
         AND (
           -- Scenario A: Older Academic Year
           (
             CASE WHEN t.year ~ '^[0-9]{4}' THEN substr(t.year, 1, 4)::integer ELSE 0 END < $3
           )
           OR 
           -- Scenario B: Same Year, but Older Term Number (e.g. Term 1 < Term 2)
           (
             (CASE WHEN t.year ~ '^[0-9]{4}' THEN substr(t.year, 1, 4)::integer ELSE 0 END = $3)
             AND 
             COALESCE(NULLIF(regexp_replace(t.term_name, '[^0-9]', '', 'g'), '')::integer, 0) < $4
           )
         )`,
      [tenantId, studentId, currentYearNum, currentTermNum]
    );

    const ledgerArrears = ledgerResult.rows[0]?.arrears ? parseFloat(ledgerResult.rows[0].arrears) : 0;

    const ledgerHistRes = await query(
      `SELECT 1 FROM student_ledger
       WHERE tenant_id = $1 AND student_id = $2 AND entry_type = 'term_fee'
       LIMIT 1`,
      [tenantId, studentId]
    );
    const useLedgerOnly = ledgerHistRes.rows.length > 0;
    const totalArrears = legacyArrears + ledgerArrears;

    // 3. Upsert into term_arrears
    if (totalArrears !== 0) {
      await query(
        `INSERT INTO term_arrears (tenant_id, student_id, current_term, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, student_id, current_term) 
         DO UPDATE SET amount = EXCLUDED.amount, created_at = NOW()`,
        [tenantId, studentId, fullTerm, totalArrears]
      );
      updatedCount++;
    } else {
      // If total is 0, clean up any existing arrears row
      await query(
        `DELETE FROM term_arrears 
         WHERE tenant_id = $1 AND student_id = $2 AND current_term = $3`,
        [tenantId, studentId, fullTerm]
      );
    }
  }

  return { studentsUpdated: updatedCount, currentTerm: fullTerm };
}
