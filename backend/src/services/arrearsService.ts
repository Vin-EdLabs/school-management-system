import { query } from '../db/connection.js';

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

  const currentYearNum = parseInt(current_year, 10);
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

  let updatedCount = 0;
  for (const studentRow of studentsRes.rows) {
    const studentId = studentRow.id;

    // A. Calculate Legacy Arrears (from fee_structures and payments)
    const legacyResult = await query(
      `SELECT term, 
       CASE 
         WHEN s.is_beneficiary = true AND s.discount_type = 'percentage' THEN fs.amount - (fs.amount * COALESCE(s.discount_value, 0) / 100)
         WHEN s.is_beneficiary = true AND s.discount_type = 'fixed' THEN GREATEST(0, fs.amount - COALESCE(s.discount_value, 0))
         ELSE fs.amount
       END as amount, 
       'fee' as type 
       FROM fee_structures fs
       JOIN students s ON s.id = $1
       WHERE fs.tenant_id = $2 AND fs.class_id = s.class_assigned_id
         AND fs.term NOT IN ($3, $4, $5)
       UNION ALL
       SELECT term, -COALESCE(amount, 0) as amount, 'payment' as type 
       FROM payments
       WHERE tenant_id = $2 AND student_id = $1
         AND term NOT IN ($3, $4, $5)`,
      [studentId, tenantId, fullTerm, current_term, termOnly]
    );

    let legacyArrears = 0;
    const admissionDate = studentRow.date_of_admission ? new Date(studentRow.date_of_admission) : null;

    for (const row of legacyResult.rows) {
      const termStr = row.term || '';
      const match = termStr.match(/\b(20\d{2})\b/);
      const year = match ? parseInt(match[1], 10) : currentYearNum;
      const rowTermNum = parseInt(termStr.match(/Term\s*(\d)/i)?.[1] || '0', 10);

      // Skip if term ended before admission date
      if (admissionDate && allTerms.length > 0) {
        const termData = allTerms.find((t: any) => 
          (t.term_name === termStr || `${t.term_name} ${t.year}` === termStr)
        );
        if (termData && termData.end_date) {
          const termEndDate = new Date(termData.end_date);
          if (termEndDate < admissionDate) {
            continue; // Student joined after this term ended
          }
        } else {
          // Fallback to year/term number check if no date range found
          const admissionYear = admissionDate.getFullYear();
          const admissionMonth = admissionDate.getMonth(); // 0-11
          let admissionTermNum = 1;
          if (admissionMonth >= 4 && admissionMonth <= 7) admissionTermNum = 2;
          else if (admissionMonth >= 8) admissionTermNum = 3;

          if (year < admissionYear || (year === admissionYear && rowTermNum < admissionTermNum)) {
            continue;
          }
        }
      }

      // Include only if Year is older, OR if same year but Term Number is older than CURRENT processing term
      if (year < currentYearNum || (year === currentYearNum && rowTermNum < currentTermNum)) {
        legacyArrears += parseFloat(row.amount);
      }
    }

    // B. Calculate Ledger Arrears (from student_ledger)
    const ledgerArrearsRes = await query(
      `SELECT (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))::numeric AS balance
       FROM student_ledger sl
       JOIN terms t ON sl.term_id = t.id
       JOIN academic_years ay ON t.academic_year_id = ay.id
       WHERE sl.tenant_id = $1 AND sl.student_id = $2
         AND t.id NOT IN (
           SELECT id FROM terms WHERE tenant_id = $1 AND (name = $3 OR name = $4 OR name = $5)
         )
         AND (
           CAST(ay.name AS INTEGER) < $6
           OR (CAST(ay.name AS INTEGER) = $6 AND (
              CAST(substring(t.name from 'Term\\s*(\\d)') AS INTEGER) < $7
           ))
         )`,
      [tenantId, studentId, fullTerm, current_term, termOnly, currentYearNum, currentTermNum]
    );
    const ledgerArrears = parseFloat(ledgerArrearsRes.rows[0].balance) || 0;

    const totalArrears = legacyArrears + ledgerArrears;

    // 3. Upsert into term_arrears
    if (totalArrears !== 0) {
      await query(
        `INSERT INTO term_arrears (tenant_id, student_id, current_term, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, student_id, current_term) 
         DO UPDATE SET amount = EXCLUDED.amount`,
        [tenantId, studentId, fullTerm, totalArrears]
      );
      updatedCount++;
    } else {
      await query(
        `DELETE FROM term_arrears 
         WHERE tenant_id = $1 AND student_id = $2 AND current_term = $3`,
        [tenantId, studentId, fullTerm]
      );
    }
  }

  return { studentsUpdated: updatedCount, currentTerm: fullTerm };
}
