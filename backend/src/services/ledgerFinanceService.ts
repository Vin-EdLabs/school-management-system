import { query, getClient } from '../db/connection.js';
import { beneficiaryAdjustedFee, SQL_BENEFICIARY_TERM_FEE_DEBIT } from '../utils/beneficiaryFee.js';
import { z } from 'zod';

// Consistent SQL query for calculating a student's cumulative balance.
// This query should be the ONLY way the main balance is calculated.
const MAIN_BALANCE_SQL = `
  SELECT
    COALESCE(SUM(debit), 0) AS total_debit,
    COALESCE(SUM(credit), 0) AS total_credit,
    (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) AS balance
  FROM student_ledger
  WHERE tenant_id = $1 AND student_id = $2;
`;

// Schema for validating student summary requests
const StudentSummarySchema = z.object({
  tenantId: z.number().int(),
  studentId: z.number().int(),
});

// Schema for validating payment records
const PaymentSchema = z.object({
  tenantId: z.number().int(),
  studentId: z.number().int(),
  academicYearId: z.number().int(),
  termId: z.number().int(),
  amount: z.number().positive(),
  description: z.string().optional(),
  paymentMethod: z.string().optional(),
  receiptNumber: z.string().optional(),
});

// Schema for posting fees for a class
const PostFeesSchema = z.object({
  tenantId: z.number().int(),
  classId: z.number().int(),
  academicYearId: z.number().int(),
  termId: z.number().int(),
});

// Schema for switching term
const SwitchTermSchema = z.object({
  tenantId: z.number().int(),
  newTermId: z.number().int(),
});

// Schema for switching term with arrears carry-forward (current = term we're leaving, new = term we're switching to)
const SwitchTermWithArrearsSchema = z.object({
  tenantId: z.number().int(),
  currentTermId: z.number().int(),
  newTermId: z.number().int(),
});

/**
 * Resolves school_settings current_year and current_term to ledger academic_year_id and term_id.
 * If no matching ledger term exists, creates academic_years and terms rows so the ledger stays in sync.
 * Used when term is switched in settings to trigger automatic fee posting.
 */
export const resolveLedgerTermFromSettings = async (
  tenantId: number,
  currentYear: string,
  currentTerm: string
): Promise<{ academicYearId: number; termId: number } | null> => {
  const year = String(currentYear || '').trim();
  const termLabel = String(currentTerm || '').trim();
  if (!year || !termLabel) return null;

  let yearRow = await query(
    'SELECT id FROM academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1',
    [tenantId, year]
  );
  let academicYearId: number;
  if (yearRow.rows.length === 0) {
    const ins = await query(
      'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
      [tenantId, year]
    );
    await query('UPDATE academic_years SET is_current = false WHERE tenant_id = $1 AND id != $2', [tenantId, ins.rows[0].id]);
    academicYearId = ins.rows[0].id;
  } else {
    academicYearId = yearRow.rows[0].id;
  }

  const termName = termLabel.replace(/\s+\d{4}$/, '').trim() || termLabel;
  let termRow = await query(
    'SELECT id FROM terms WHERE tenant_id = $1 AND academic_year_id = $2 AND (name = $3 OR name = $4) LIMIT 1',
    [tenantId, academicYearId, termLabel, termName]
  );
  let termId: number;
  if (termRow.rows.length === 0) {
    const ins = await query(
      'INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true) RETURNING id',
      [tenantId, academicYearId, termName]
    );
    await query('UPDATE terms SET is_current = false WHERE tenant_id = $1 AND id != $2', [tenantId, ins.rows[0].id]);
    termId = ins.rows[0].id;
  } else {
    termId = termRow.rows[0].id;
  }

  return { academicYearId, termId };
};

/**
 * Calculates a student's financial summary, including their cumulative balance and full ledger history.
 */
export const getStudentSummary = async (tenantId: number, studentId: number) => {
  const { tenantId: validatedTenantId, studentId: validatedStudentId } = StudentSummarySchema.parse({ tenantId, studentId });

  // Get the cumulative balance.
  const balanceResult = await query(MAIN_BALANCE_SQL, [validatedTenantId, validatedStudentId]);
  const balanceData = balanceResult.rows[0];

  // Get the full ledger history.
  const ledgerHistoryResult = await query(
    'SELECT * FROM student_ledger WHERE tenant_id = $1 AND student_id = $2 ORDER BY created_at ASC',
    [validatedTenantId, validatedStudentId]
  );

  const balance = parseFloat(balanceData.balance);
  let status = 'cleared';
  if (balance > 0) {
    status = 'owing';
  } else if (balance < 0) {
    status = 'credit';
  }

  const settingsRow = await query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [validatedTenantId]
  );
  const current_term = String(settingsRow.rows[0]?.current_term || '').trim();
  const current_year = String(settingsRow.rows[0]?.current_year || '').trim();

  let term_arrears = 0;
  if (current_term) {
    const arRes = await query(
      `SELECT amount FROM term_arrears
       WHERE tenant_id = $1 AND student_id = $2
         AND (current_term = $3 OR $3 LIKE current_term || '%' OR current_term LIKE $3 || '%')`,
      [validatedTenantId, validatedStudentId, current_term]
    );
    term_arrears = parseFloat(arRes.rows[0]?.amount || '0');
    if (!Number.isFinite(term_arrears)) term_arrears = 0;
  }

  return {
    total_debit: parseFloat(balanceData.total_debit),
    total_credit: parseFloat(balanceData.total_credit),
    balance,
    status,
    history: ledgerHistoryResult.rows,
    /** School settings — active academic period */
    current_term,
    current_year,
    /** Carried-forward arrears attributed to the current term (from `term_arrears`; refreshed after ledger changes). */
    term_arrears,
  };
};

/**
 * Posts term fees for all students in a given class.
 */
export const postFeesForClass = async (tenantId: number, classId: number, academicYearId: number, termId: number) => {
  const {
    tenantId: validatedTenantId,
    classId: validatedClassId,
    academicYearId: validatedAcademicYearId,
    termId: validatedTermId,
  } = PostFeesSchema.parse({ tenantId, classId, academicYearId, termId });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    console.log(`[postFeesForClass] Tenant: ${validatedTenantId}, Class: ${validatedClassId}, Term: ${validatedTermId}`);

    // 1. Get the fee structure for the class and term.
    const feeStructureResult = await client.query(
      'SELECT total, (SELECT name FROM terms WHERE id = $4) as term_name FROM ledger_fee_structures WHERE tenant_id = $1 AND class_id = $2 AND academic_year_id = $3 AND term_id = $4',
      [validatedTenantId, validatedClassId, validatedAcademicYearId, validatedTermId]
    );

    if (feeStructureResult.rows.length === 0) {
      console.error(`[postFeesForClass] Fee structure not found for Tenant: ${validatedTenantId}, Class: ${validatedClassId}, Term: ${validatedTermId}`);
      throw new Error('Fee structure not found for this class, academic year, and term.');
    }
    const feeAmount = parseFloat(feeStructureResult.rows[0].total);
    const termName = feeStructureResult.rows[0].term_name;
    const description = `${termName} Fee`;
    console.log(`[postFeesForClass] Found fee structure. Amount: ${feeAmount}`);

    // 2. Get all students in the class.
    const studentsResult = await client.query(
      'SELECT id FROM students WHERE tenant_id = $1 AND class_assigned_id = $2',
      [validatedTenantId, validatedClassId]
    );
    console.log(`[postFeesForClass] Found ${studentsResult.rows.length} students in class.`);

    if (studentsResult.rows.length === 0) {
      return { message: 'No students found in this class.', postedCount: 0, skippedCount: 0 };
    }

    let postedCount = 0;
    let skippedCount = 0;

    // 3. For each student, insert a new debit entry into the ledger with discount applied.
    for (const student of studentsResult.rows) {
      try {
        const studentDetailsRes = await client.query(
          'SELECT is_beneficiary, discount_type, discount_value FROM students WHERE id = $1',
          [student.id]
        );
        const s = studentDetailsRes.rows[0];
        const { totalFees: finalFee } = beneficiaryAdjustedFee(feeAmount, s);

        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'term_fee')`,
          [validatedTenantId, student.id, validatedAcademicYearId, validatedTermId, description, finalFee]
        );
        postedCount++;
      } catch (error: any) {
        // If the unique constraint is violated, it means the fee has already been posted.
        if (error.code === '23505') { // Unique violation
          skippedCount++;
        } else {
          throw error;
        }
      }
    }

    await client.query('COMMIT');
    const result = {
      message: `Fees posted successfully for class.`,
      postedCount,
      skippedCount,
      totalStudents: studentsResult.rows.length,
    };
    console.log('[postFeesForClass] Result:', result);
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error posting fees:', error);
    throw new Error('Failed to post fees. Transaction rolled back.');
  } finally {
    client.release();
  }
};

/**
 * Records a payment for a student.
 */
export const recordPayment = async (paymentData: z.infer<typeof PaymentSchema>) => {
  const validatedData = PaymentSchema.parse(paymentData);
  const { tenantId, studentId, academicYearId, termId, amount, description, paymentMethod, receiptNumber } = validatedData;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const paymentDescription = description || 'Payment';

    const result = await client.query(
      `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, payment_method, receipt_number)
             VALUES ($1, $2, $3, $4, $5, 0, $6, 'payment', $7, $8) RETURNING *`,
      [tenantId, studentId, academicYearId, termId, paymentDescription, amount, paymentMethod, receiptNumber]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    throw new Error('Failed to record payment. Transaction rolled back.');
  } finally {
    client.release();
  }
};

/**
 * Posts term fees for all students in a tenant for a new term.
 * This is useful when switching the active term for the whole school.
 */
export const postFeesForNewTerm = async (tenantId: number, newTermId: number) => {
  const { tenantId: validatedTenantId, newTermId: validatedNewTermId } = SwitchTermSchema.parse({ tenantId, newTermId });

  console.log(`[postFeesForNewTerm] Starting fee posting for Tenant: ${validatedTenantId}, New Term: ${validatedNewTermId}`);

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sql = `
            INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
            SELECT
                s.tenant_id,
                s.id as student_id,
                t.academic_year_id,
                t.id as term_id,
                'Term Fee - ' || t.name as description,
                'term_fee' as entry_type,
                (${SQL_BENEFICIARY_TERM_FEE_DEBIT.trim()}) as debit,
                0 as credit
            FROM students s
            INNER JOIN classes c ON s.class_assigned_id = c.id
            INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
            INNER JOIN ledger_fee_structures fs ON fs.class_id = c.id
                AND fs.academic_year_id = t.academic_year_id
                AND fs.term_id = t.id
            WHERE s.tenant_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM student_ledger sl
                WHERE sl.student_id = s.id
                  AND sl.term_id = $2
                  AND sl.entry_type = 'term_fee'
                  AND sl.tenant_id = $1
            );
        `;

    const result = await client.query(sql, [validatedTenantId, validatedNewTermId]);

    await client.query('COMMIT');

    console.log(`[postFeesForNewTerm] Completed. Inserted ${result.rowCount} new term fee entries.`);

    return {
      message: `Successfully posted fees for new term.`,
      insertedCount: result.rowCount,
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[postFeesForNewTerm] Error:', error);
    throw new Error('Failed to post fees for the new term. Transaction rolled back.');
  } finally {
    client.release();
  }
};

/**
 * Switches to a new term. For every student:
 *  1. Reads their balance in the PREVIOUS term (term_id = currentTermId) directly.
 *     - SUM(debit) - SUM(credit) for that term only.
 *     - This naturally includes any arrears rows already in that term from prior switches,
 *       so the cumulative carry-forward builds up correctly across multiple terms.
 *  2. If balance > 0, inserts ONE arrears debit row in the NEW term.
 *  3. Stores the balance in term_outstanding_balances for audit.
 *  4. Posts the new term_fee debit for students who have a fee structure.
 *
 * Uses currentTermId / newTermId directly — NO ordering by term.id or academic_year_id.
 * This is the only correct approach because term IDs are not guaranteed to be sequential.
 */
export const postFeesForNewTermWithArrears = async (
  tenantId: number,
  currentTermId: number,
  newTermId: number
) => {
  const {
    tenantId: tid,
    currentTermId: prevTermId,
    newTermId: nextTermId,
  } = SwitchTermWithArrearsSchema.parse({ tenantId, currentTermId, newTermId });

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Validate both terms exist and belong to this tenant
    const termRows = await client.query(
      `SELECT id, academic_year_id, name FROM terms WHERE tenant_id = $1 AND id = ANY($2::int[])`,
      [tid, [prevTermId, nextTermId]]
    );
    const termMap: Record<number, any> = {};
    for (const r of termRows.rows) termMap[r.id] = r;

    if (!termMap[prevTermId]) {
      throw new Error(`Term ID ${prevTermId} not found for tenant ${tid}. Cannot carry arrears.`);
    }
    if (!termMap[nextTermId]) {
      throw new Error(`Term ID ${nextTermId} not found for tenant ${tid}. Cannot switch term.`);
    }

    const newAyId = termMap[nextTermId].academic_year_id;

    // ── STEP 1: Read the global running balance per student ──────────────────
    // SUM(debit) - SUM(credit) across ALL terms.
    // This represents the true outstanding amount to carry forward.
    const prevBalances = await client.query(
      `SELECT student_id,
              (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0))::numeric AS balance
       FROM student_ledger
       WHERE tenant_id = $1
       GROUP BY student_id
       HAVING (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) > 0`,
      [tid]
    );

    console.log(
      `[switchTerm] prev_term=${prevTermId} next_term=${nextTermId} ` +
      `students_with_balance=${prevBalances.rows.length}`
    );

    const fullWaiverRes = await client.query(
      `SELECT id FROM students WHERE tenant_id = $1 AND is_beneficiary = true
       AND (
         discount_type IS NULL OR TRIM(COALESCE(discount_type::text, '')) = ''
         OR (LOWER(TRIM(discount_type::text)) = 'percentage' AND COALESCE(discount_value, 0) >= 100)
       )`,
      [tid]
    );
    const fullWaiverStudentIds = new Set(fullWaiverRes.rows.map((r: { id: number }) => Number(r.id)));

    // ── STEP 2: Guard against duplicate arrears ───────────────────────────────
    const existingArrearsRes = await client.query(
      `SELECT student_id FROM student_ledger
       WHERE tenant_id = $1 AND term_id = $2 AND entry_type = 'arrears'`,
      [tid, nextTermId]
    );
    const alreadyHasArrears = new Set(existingArrearsRes.rows.map((r: any) => Number(r.student_id)));

    // ── STEP 3: Insert arrears rows ───────────────────────────────────────────
    let arrearsInserted = 0;
    const prevTerm = termMap[prevTermId];
    const nextTerm = termMap[nextTermId];

    // Use full term name (e.g. "Term 3 2026") for consistency with school_settings/UI matching
    const nextAyRes = await client.query('SELECT name FROM academic_years WHERE id = $1', [nextTerm.academic_year_id]);
    const nextAyName = nextAyRes.rows[0]?.name || '';
    const fullNextTermName = (nextAyName && !nextTerm.name.includes(nextAyName)) 
      ? `${nextTerm.name} ${nextAyName}`.trim() 
      : nextTerm.name;

    const prevAyRes = await client.query('SELECT name FROM academic_years WHERE id = $1', [prevTerm.academic_year_id]);
    const prevAyName = prevAyRes.rows[0]?.name || '';
    const fullPrevTermName = (prevAyName && !prevTerm.name.includes(prevAyName)) 
      ? `${prevTerm.name} ${prevAyName}`.trim() 
      : prevTerm.name;
    for (const row of prevBalances.rows) {
      const balance = parseFloat(row.balance);
      const studentId = Number(row.student_id);
      if (balance <= 0) continue;
      if (fullWaiverStudentIds.has(studentId)) continue;

      // 3.1 Update term_arrears (simple view used by Student Balances / receipts)
      // This ensures the "Arrears" label in UI is accurate
      await client.query(
        `INSERT INTO term_arrears (tenant_id, student_id, current_term, from_term, amount)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (tenant_id, student_id, current_term)
         DO UPDATE SET amount = EXCLUDED.amount, from_term = EXCLUDED.from_term`,
        [tid, studentId, fullNextTermName, fullPrevTermName, balance]
      );
      if (alreadyHasArrears.has(studentId)) continue;

      // 3.2 Persist in term_outstanding_balances (snapshot)
      await client.query(
        `INSERT INTO term_outstanding_balances
           (tenant_id, term_id, student_id, outstanding_balance, calculated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (tenant_id, term_id, student_id)
         DO UPDATE SET outstanding_balance = $4, calculated_at = CURRENT_TIMESTAMP`,
        [tid, prevTermId, studentId, balance]
      );

      // 3.3 Real ledger row — MEMO ONLY (amount 0) to avoid double-counting in running balance
      await client.query(
        `INSERT INTO student_ledger
           (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
         VALUES ($1, $2, $3, $4, $5, 'arrears', 0, 0)`,
        [tid, studentId, newAyId, nextTermId, `Arrears brought forward from ${fullPrevTermName}: GHS ${balance.toFixed(2)}`]
      );

      arrearsInserted++;
      alreadyHasArrears.add(studentId);
      console.log(`[switchTerm] arrears memo student=${studentId} amount=${balance} -> term ${nextTermId}`);
    }

    // ── STEP 4: Post new term fees (skip students already billed) ─────────────
    const feeResult = await client.query(
      `INSERT INTO student_ledger
         (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
       SELECT
         s.tenant_id, s.id, t.academic_year_id, t.id,
         'Term Fee - ' || t.name, 'term_fee', 
         (${SQL_BENEFICIARY_TERM_FEE_DEBIT.trim()}), 0
       FROM students s
       INNER JOIN classes c ON s.class_assigned_id = c.id
       INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
       INNER JOIN ledger_fee_structures fs
         ON fs.class_id = c.id
        AND fs.academic_year_id = t.academic_year_id
        AND fs.term_id = t.id
       WHERE s.tenant_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM student_ledger sl
           WHERE sl.student_id = s.id
             AND sl.term_id = $2
             AND sl.entry_type = 'term_fee'
             AND sl.tenant_id = $1
         )`,
      [tid, nextTermId]
    );

    await client.query('COMMIT');

    console.log(
      `[switchTerm] DONE arrears_inserted=${arrearsInserted} ` +
      `fees_inserted=${feeResult.rowCount} new_term=${nextTermId}`
    );

    return {
      message: `Term switched. Arrears carried: ${arrearsInserted}. Term fees posted: ${feeResult.rowCount}.`,
      arrearsRowsInserted: arrearsInserted,
      termFeesInserted: feeResult.rowCount,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[switchTerm] ERROR:', err);
    throw err;
  } finally {
    client.release();
  }
};

/** Derive previous term label for fallback backfill from old fee_structures/payments (e.g. "Term 2 2027" -> "Term 1 2027"). */
function derivePreviousTermLabel(currentTerm: string): string {
  const t = String(currentTerm || '').trim();
  const yearMatch = t.match(/\s*(\d{4})\s*$/);
  const year = yearMatch ? yearMatch[1] : '';
  const rest = yearMatch ? t.slice(0, yearMatch.index).trim() : t;
  if (/Term\s*3/i.test(rest)) return (rest.replace(/Term\s*3/i, 'Term 2') + (year ? ` ${year}` : '')).trim();
  if (/Term\s*2/i.test(rest)) return (rest.replace(/Term\s*2/i, 'Term 1') + (year ? ` ${year}` : '')).trim();
  if (/Term\s*1/i.test(rest)) return (rest.replace(/Term\s*1/i, 'Term 1') + (year ? ` ${year}` : '')).trim();
  if (/\b2\b/.test(rest)) return (rest.replace(/\b2\b/, '1') + (year ? ` ${year}` : '')).trim();
  return year ? `Term 1 ${year}` : 'Term 1';
}

/**
 * Backfill arrears for the current term (from settings).
 * Use when term was already switched but arrears were not inserted (e.g. name mismatch).
 * Finds the chronologically previous term that has term_fee entries (same year or any earlier year),
 * then for each student with unpaid balance in that term inserts carry_forward_credit + arrears rows if not already present.
 * Idempotent: skips students who already have an 'arrears' row for the current term.
 */
export const backfillArrearsForCurrentTerm = async (tenantId: number) => {
  const settingsResult = await query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [tenantId]
  );
  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].current_term || !settingsResult.rows[0].current_year) {
    throw new Error('School settings must have current term and current year set.');
  }
  const { current_term: currentTerm, current_year: currentYear } = settingsResult.rows[0];
  const newLedgerTerm = await resolveLedgerTermFromSettings(tenantId, currentYear, currentTerm);
  if (!newLedgerTerm) throw new Error('Could not resolve current term to ledger term.');

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const newTermId = newLedgerTerm.termId;
    const newAyId = newLedgerTerm.academicYearId;

    // Previous term = chronologically last term before current (same or any earlier academic year) that has term_fee entries
    const prevTermResult = await client.query(
      `SELECT t.id, t.academic_year_id
       FROM terms t
       INNER JOIN (SELECT DISTINCT term_id FROM student_ledger WHERE tenant_id = $1 AND entry_type = 'term_fee') sl ON sl.term_id = t.id
       WHERE t.tenant_id = $1 AND t.id != $2
         AND (t.academic_year_id < $3 OR (t.academic_year_id = $3 AND t.id < $2))
       ORDER BY t.academic_year_id DESC, t.id DESC LIMIT 1`,
      [tenantId, newTermId, newAyId]
    );
    if (prevTermResult.rows.length === 0) {
      // If this looks like a first term (e.g. "Term 1 ..."), there is no previous term to backfill.
      const lower = String(currentTerm || '').toLowerCase();
      if (/term\s*1\b/.test(lower) || /\b1st\b/.test(lower)) {
        await client.query('COMMIT');
        return {
          message: 'No previous academic term detected for current term. Nothing to backfill.',
          studentsProcessed: 0,
          arrearsRowsInserted: 0,
          creditRowsInserted: 0,
        };
      }

      // Fallback: no previous term in ledger (e.g. older data only in fee_structures/payments). Compute unpaid from old tables and insert arrears only.
      const prevTermLabel = derivePreviousTermLabel(currentTerm);
      const prevTermOnly = prevTermLabel.replace(/\s+\d{4}$/, '').trim() || prevTermLabel;
      const feeStruct = await client.query(
        `SELECT fs.class_id, COALESCE(SUM(fs.amount), 0)::numeric AS total
         FROM fee_structures fs
         WHERE fs.tenant_id = $1 AND (fs.term = $2 OR fs.term = $3 OR fs.term LIKE $4 OR fs.term LIKE $5)
         GROUP BY fs.class_id`,
        [tenantId, prevTermLabel, prevTermOnly, `${prevTermLabel}%`, `%${prevTermOnly}%`]
      );
      if (feeStruct.rows.length === 0) {
        await client.query('COMMIT');
        return { message: 'No previous term in ledger and no fee_structures for previous term. Nothing to backfill.', studentsProcessed: 0, arrearsRowsInserted: 0 };
      }
      const classFees = Object.fromEntries(feeStruct.rows.map((r: any) => [r.class_id, parseFloat(r.total) || 0]));
      const paidResult = await client.query(
        `SELECT student_id, COALESCE(SUM(amount), 0)::numeric AS total_paid
         FROM payments WHERE tenant_id = $1 AND (term = $2 OR term = $3 OR term LIKE $4 OR term LIKE $5) GROUP BY student_id`,
        [tenantId, prevTermLabel, prevTermOnly, `${prevTermLabel}%`, `%${prevTermOnly}%`]
      );
      const paidByStudent = Object.fromEntries(paidResult.rows.map((r: any) => [r.student_id, parseFloat(r.total_paid) || 0]));
      const studentsWithClass = await client.query(
        'SELECT id, class_assigned_id FROM students WHERE tenant_id = $1 AND class_assigned_id IS NOT NULL',
        [tenantId]
      );
      const existingArrears = await client.query(
        `SELECT student_id FROM student_ledger WHERE tenant_id = $1 AND term_id = $2 AND entry_type = 'arrears'`,
        [tenantId, newTermId]
      );
      const alreadyHas = new Set((existingArrears.rows as any[]).map((r: any) => r.student_id));
      let inserted = 0;
      for (const s of studentsWithClass.rows) {
        const classId = s.class_assigned_id;
        const fee = classFees[classId] ?? 0;
        const paid = paidByStudent[s.id] ?? 0;
        const unpaid = fee - paid;
        if (unpaid <= 0 || alreadyHas.has(s.id)) continue;
        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
           VALUES ($1, $2, $3, $4, 'Arrears from previous term (migrated)', 'arrears', $5, 0)`,
          [tenantId, s.id, newAyId, newTermId, unpaid]
        );
        inserted++;
        alreadyHas.add(s.id);
      }
      await client.query('COMMIT');
      return {
        message: inserted > 0 ? `Backfilled ${inserted} arrears from old fee/payment data (previous term: ${prevTermLabel}).` : 'No unpaid balances in previous term (old system).',
        studentsProcessed: studentsWithClass.rows.length,
        arrearsRowsInserted: inserted,
        creditRowsInserted: 0,
      };
    }

    const prevTermId = prevTermResult.rows[0].id;
    const prevAyId = prevTermResult.rows[0].academic_year_id;

    // CUMULATIVE balance across ALL terms STRICTLY BEFORE the new term (newTermId).
    // This ensures that by the time we reach Term 3, arrears reflect Term1+Term2 unpaid, etc.
    // Uses ID-based comparison: (academic_year_id < newAyId) OR (academic_year_id = newAyId AND term_id < newTermId)
    const balanceRows = await client.query(
      `SELECT sl.student_id, (COALESCE(SUM(sl.debit),0) - COALESCE(SUM(sl.credit),0))::numeric AS balance
       FROM student_ledger sl
       INNER JOIN terms tt ON tt.id = sl.term_id
       WHERE sl.tenant_id = $1
         AND (tt.academic_year_id < $2 OR (tt.academic_year_id = $2 AND tt.id < $3))
       GROUP BY sl.student_id
       HAVING (COALESCE(SUM(sl.debit),0) - COALESCE(SUM(sl.credit),0)) != 0`,
      [tenantId, newAyId, newTermId]
    );

    const existingArrears = await client.query(
      `SELECT student_id FROM student_ledger
       WHERE tenant_id = $1 AND term_id = $2 AND entry_type = 'arrears'`,
      [tenantId, newTermId]
    );
    const existingCreditFwd = await client.query(
      `SELECT student_id FROM student_ledger
       WHERE tenant_id = $1 AND term_id = $2 AND entry_type = 'credit_brought_forward'`,
      [tenantId, newTermId]
    );
    const alreadyHasArrears = new Set((existingArrears.rows as any[]).map((r: any) => r.student_id));
    const alreadyHasCreditFwd = new Set((existingCreditFwd.rows as any[]).map((r: any) => r.student_id));

    let arrearsInserted = 0;
    let creditsInserted = 0;
    for (const row of balanceRows.rows) {
      const studentId = row.student_id;
      const balance = parseFloat(row.balance);

      if (balance > 0) {
        if (alreadyHasArrears.has(studentId)) continue;
        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
           VALUES ($1, $2, $3, $4, 'Balance carried forward to next term', 'carry_forward_credit', 0, $5)`,
          [tenantId, studentId, prevAyId, prevTermId, balance]
        );
        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
           VALUES ($1, $2, $3, $4, 'Arrears from previous term', 'arrears', $5, 0)`,
          [tenantId, studentId, newAyId, newTermId, balance]
        );
        arrearsInserted++;
        alreadyHasArrears.add(studentId);
      } else if (balance < 0) {
        if (alreadyHasCreditFwd.has(studentId)) continue;
        const creditAmount = Math.abs(balance);
        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
           VALUES ($1, $2, $3, $4, 'Credit carried forward to next term', 'carry_forward_debit', $5, 0)`,
          [tenantId, studentId, prevAyId, prevTermId, creditAmount]
        );
        await client.query(
          `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
           VALUES ($1, $2, $3, $4, 'Credit from previous term', 'credit_brought_forward', 0, $5)`,
          [tenantId, studentId, newAyId, newTermId, creditAmount]
        );
        creditsInserted++;
        alreadyHasCreditFwd.add(studentId);
      }
    }

    await client.query('COMMIT');
    const parts = [];
    if (arrearsInserted > 0) parts.push(`${arrearsInserted} arrears`);
    if (creditsInserted > 0) parts.push(`${creditsInserted} credit(s)`);
    return {
      message: `Backfilled for current term. ${parts.length ? parts.join(', ') + ' inserted.' : 'No new rows (already present).'}`,
      studentsProcessed: balanceRows.rows.length,
      arrearsRowsInserted: arrearsInserted,
      creditRowsInserted: creditsInserted,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => { });
    console.error('[backfillArrearsForCurrentTerm] Error:', error);
    throw error;
  } finally {
    client.release();
  }
};

export type ManualBalanceOverrideInput = {
  tenantId: number;
  studentId: number;
  academicYearId: number;
  termId: number;
  newBalance: number;
  adjustmentAmount: number;
  reasonCategory: string;
  notes: string;
  documentUrl: string | null;
  createdByUserId: number;
  approvedByUserId: number | null;
  periodLabel: string | null;
};

/**
 * Append-only ledger entry for a manual balance correction (audit trail).
 * Positive adjustment increases amount owing (debit); negative reduces owing (credit).
 */
export async function recordManualBalanceOverride(input: ManualBalanceOverrideInput) {
  const previousBalance = Math.round((input.newBalance - input.adjustmentAmount) * 100) / 100;
  const desc = `Manual balance override: GH₵${previousBalance.toFixed(2)} → GH₵${input.newBalance.toFixed(2)} (${input.reasonCategory})`;
  const debit = input.adjustmentAmount > 0 ? input.adjustmentAmount : 0;
  const credit = input.adjustmentAmount < 0 ? -input.adjustmentAmount : 0;

  const result = await query(
    `INSERT INTO student_ledger (
      tenant_id, student_id, academic_year_id, term_id, description, entry_type,
      debit, credit, adjustment_category, adjustment_notes, supporting_document_url,
      approved_by_user_id, created_by_user_id, adjustment_amount, period_label
    ) VALUES ($1, $2, $3, $4, $5, 'manual_adjustment', $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING id, created_at, debit, credit, adjustment_amount`,
    [
      input.tenantId,
      input.studentId,
      input.academicYearId,
      input.termId,
      desc,
      debit,
      credit,
      input.reasonCategory,
      input.notes,
      input.documentUrl,
      input.approvedByUserId,
      input.createdByUserId,
      input.adjustmentAmount,
      input.periodLabel,
    ]
  );
  return result.rows[0];
}
