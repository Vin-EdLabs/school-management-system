import { query, getClient } from '../db/connection.js';
import type pg from 'pg';
import { beneficiaryAdjustedFee, SQL_BENEFICIARY_TERM_FEE_DEBIT } from '../utils/beneficiaryFee.js';
import { z } from 'zod';
import { getStudentFullBalance, SQL_TRUE_OUTSTANDING, SQL_TRUE_OUTSTANDING_DEBIT, SQL_EFFECTIVE_CREDIT } from './studentUnifiedBalanceService.js';

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

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

  const fullBalance = await getStudentFullBalance(null, validatedTenantId, validatedStudentId);
  const term_arrears = fullBalance?.totalArrears ?? 0;

  return {
    total_debit: parseFloat(balanceData.total_debit),
    total_credit: parseFloat(balanceData.total_credit),
    balance,
    status,
    history: ledgerHistoryResult.rows,
    current_term,
    current_year,
    /** Carried-forward arrears on current term — from student_ledger (not term_arrears cache). */
    term_arrears,
    liveBalance: fullBalance,
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
      `SELECT id FROM students
       WHERE tenant_id = $1 AND class_assigned_id = $2
         AND COALESCE(enrollment_status, 'active') = 'active'`,
      [validatedTenantId, validatedClassId]
    );
    console.log(`[postFeesForClass] Found ${studentsResult.rows.length} students in class.`);

    if (studentsResult.rows.length === 0) {
      return { message: 'No students found in this class.', postedCount: 0, skippedCount: 0 };
    }

    let postedCount = 0;
    let skippedCount = 0;

    // 3. For each student, upsert term_fee debit (idempotent — safe when fees already posted).
    for (const student of studentsResult.rows) {
      const studentDetailsRes = await client.query(
        'SELECT is_beneficiary, discount_type, discount_value FROM students WHERE id = $1',
        [student.id]
      );
      const s = studentDetailsRes.rows[0];
      const { totalFees: finalFee } = beneficiaryAdjustedFee(feeAmount, s);

      await client.query(
        `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'term_fee')
         ON CONFLICT (tenant_id, student_id, academic_year_id, term_id)
         WHERE entry_type = 'term_fee'
         DO UPDATE SET debit = EXCLUDED.debit, description = EXCLUDED.description`,
        [validatedTenantId, student.id, validatedAcademicYearId, validatedTermId, description, finalFee]
      );
      postedCount++;
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
              AND COALESCE(s.enrollment_status, 'active') = 'active'
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
 * Idempotent: posts term_fee ledger debits for active students who have a fee structure
 * but no term_fee row yet (e.g. students/classes added directly in the database).
 * Matches fee structures by class id or by normalized class name alias.
 */
export async function syncMissingLedgerTermFeesForActiveTerm(tenantId: number): Promise<{
  termId: number | null;
  insertedCount: number;
}> {
  const settingsRes = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term;
  const currentYear = settingsRes.rows[0]?.current_year;
  if (!currentTerm || !currentYear) {
    return { termId: null, insertedCount: 0 };
  }

  const resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
  if (!resolved) {
    return { termId: null, insertedCount: 0 };
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const sql = `
      INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
      SELECT DISTINCT ON (s.id)
        s.tenant_id,
        s.id,
        t.academic_year_id,
        t.id,
        'Term Fee - ' || t.name,
        'term_fee',
        (${SQL_BENEFICIARY_TERM_FEE_DEBIT.trim()}),
        0
      FROM students s
      INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
      INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
      INNER JOIN ledger_fee_structures fs ON fs.tenant_id = s.tenant_id
        AND fs.academic_year_id = t.academic_year_id
        AND fs.term_id = t.id
        AND (
          fs.class_id = s.class_assigned_id
          OR fs.class_id IN (
            SELECT c_alt.id
            FROM classes c_alt
            WHERE c_alt.tenant_id = s.tenant_id
              AND LOWER(TRIM(COALESCE(c_alt.class_name, c_alt.name, ''))) =
                  LOWER(TRIM(COALESCE(c_student.class_name, c_student.name, '')))
              AND TRIM(COALESCE(c_alt.class_name, c_alt.name, '')) <> ''
          )
        )
      WHERE s.tenant_id = $1
        AND COALESCE(s.enrollment_status, 'active') = 'active'
        AND s.class_assigned_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM student_ledger sl
          WHERE sl.tenant_id = $1
            AND sl.student_id = s.id
            AND sl.term_id = $2
            AND sl.entry_type = 'term_fee'
        )
      ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
    `;

    const result = await client.query(sql, [tenantId, resolved.termId]);
    await client.query('COMMIT');

    const insertedCount = result.rowCount ?? 0;
    if (insertedCount > 0) {
      console.log(
        `[syncMissingLedgerTermFees] Tenant ${tenantId}: inserted ${insertedCount} term_fee row(s) for term ${resolved.termId}`
      );
    }

    return { termId: resolved.termId, insertedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[syncMissingLedgerTermFees] Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Switches to a new term (term close carry-forward only).
 * For each student on the closing term:
 *   net_balance = SUM(debit) - SUM(credit)
 *   net > 0 → arrears on next term
 *   net < 0 → carry_forward_credit on next term (full amount, not consumed mid-term)
 * Then posts term_fee for the new term. Credit is never auto-applied within the term.
 */
export const executeTermSwitchWithArrears = async (
  client: pg.PoolClient,
  tenantId: number,
  currentTermId: number,
  newTermId: number
) => {
  const {
    tenantId: tid,
    currentTermId: prevTermId,
    newTermId: nextTermId,
  } = SwitchTermWithArrearsSchema.parse({ tenantId, currentTermId, newTermId });
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

    const prevTerm = termMap[prevTermId];
    const ayRows = await client.query(
      `SELECT id, name FROM academic_years WHERE id = ANY($1::int[])`,
      [[prevTerm.academic_year_id, newAyId]]
    );
    const ayNameById: Record<number, string> = {};
    for (const r of ayRows.rows) ayNameById[Number(r.id)] = String(r.name || '');
    const prevAyName = ayNameById[prevTerm.academic_year_id] || '';
    const previousTermLabel =
      prevAyName && !prevTerm.name.includes(prevAyName)
        ? `${prevTerm.name} ${prevAyName}`.trim()
        : prevTerm.name;

    const fullWaiverRes = await client.query(
      `SELECT id FROM students WHERE tenant_id = $1 AND is_beneficiary = true
       AND (
         discount_type IS NULL OR TRIM(COALESCE(discount_type::text, '')) = ''
         OR (LOWER(TRIM(discount_type::text)) = 'percentage' AND COALESCE(discount_value, 0) >= 100)
       )`,
      [tid]
    );
    const fullWaiverStudentIds = new Set(fullWaiverRes.rows.map((r: { id: number }) => Number(r.id)));

    // ── STEP 1: Closing balance per student for the term we are leaving ─────────
    // closing_balance = SUM(debit) - SUM(credit); >0 owes (arrears), <0 overpaid (credit)
    const closingRes = await client.query(
      `SELECT student_id,
              COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS closing_balance
       FROM student_ledger
       WHERE tenant_id = $1 AND term_id = $2
       GROUP BY student_id
       HAVING COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) != 0`,
      [tid, prevTermId]
    );

    let arrearsInserted = 0;
    let creditsCarried = 0;
    let totalApplied = 0;
    let totalCreditApplied = 0;

    for (const row of closingRes.rows) {
      const studentId = Number(row.student_id);
      if (fullWaiverStudentIds.has(studentId)) continue;

      const closingBalance = roundMoney(parseFloat(row.closing_balance) || 0);
      if (Math.abs(closingBalance) < 0.001) continue;

      if (closingBalance < 0) {
        const creditAmount = roundMoney(Math.abs(closingBalance));
        const creditDescription = `Credit carried forward from ${previousTermLabel}`;
        const exists = await client.query(
          `SELECT id FROM student_ledger
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
             AND entry_type = 'carry_forward_credit'
             AND description LIKE $4
           LIMIT 1`,
          [tid, studentId, nextTermId, `%${previousTermLabel}%`]
        );
        if (exists.rows.length > 0) continue;

        await client.query(
          `INSERT INTO student_ledger
             (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit, metadata)
           VALUES ($1, $2, $3, $4, $5, 'carry_forward_credit', 0, $6, $7::jsonb)`,
          [
            tid,
            studentId,
            newAyId,
            nextTermId,
            creditDescription,
            creditAmount,
            JSON.stringify({ carried_from_term_id: prevTermId, amount: creditAmount }),
          ]
        );
        creditsCarried++;
        totalCreditApplied += creditAmount;
      } else {
        const arrearsAmount = roundMoney(closingBalance);
        const arrearsDescription = `Arrears brought forward from ${previousTermLabel}`;
        const exists = await client.query(
          `SELECT id FROM student_ledger
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
             AND entry_type = 'arrears'
             AND description LIKE $4
           LIMIT 1`,
          [tid, studentId, nextTermId, `%${previousTermLabel}%`]
        );
        if (exists.rows.length > 0) continue;

        await client.query(
          `INSERT INTO student_ledger
             (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit, metadata)
           VALUES ($1, $2, $3, $4, $5, 'arrears', $6, 0, $7::jsonb)`,
          [
            tid,
            studentId,
            newAyId,
            nextTermId,
            arrearsDescription,
            arrearsAmount,
            JSON.stringify({ carried_from_term_id: prevTermId, amount: arrearsAmount }),
          ]
        );
        arrearsInserted++;
        totalApplied += arrearsAmount;
      }
    }

    console.log(
      `[carryForward] tenant=${tid} prev_term=${prevTermId} new_term=${nextTermId} ` +
        `arrears=${arrearsInserted} credits=${creditsCarried} ` +
        `total_arrears=${totalApplied.toFixed(2)} total_credits=${totalCreditApplied.toFixed(2)}`
    );

    // ── STEP 2: Post new term fees (skip students already billed) ─────────────
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
         AND COALESCE(s.enrollment_status, 'active') = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM student_ledger sl
           WHERE sl.student_id = s.id
             AND sl.term_id = $2
             AND sl.entry_type = 'term_fee'
             AND sl.tenant_id = $1
         )`,
      [tid, nextTermId]
    );

    return {
      message:
        `Term switched. Arrears carried: ${arrearsInserted} students (GH₵${totalApplied.toFixed(2)}). ` +
        `Credits carried: ${creditsCarried} students (GH₵${totalCreditApplied.toFixed(2)}). ` +
        `Term fees posted: ${feeResult.rowCount}.`,
      arrearsRowsInserted: arrearsInserted,
      creditRowsInserted: creditsCarried,
      termFeesInserted: feeResult.rowCount,
      totalArrearsAmount: totalApplied,
      totalCreditAmount: totalCreditApplied,
    };
};

export const postFeesForNewTermWithArrears = async (
  tenantId: number,
  currentTermId: number,
  newTermId: number
) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await executeTermSwitchWithArrears(client, tenantId, currentTermId, newTermId);
    await client.query('COMMIT');
    console.log(
      `[switchTerm] DONE arrears_inserted=${result.arrearsRowsInserted} ` +
        `fees_inserted=${result.termFeesInserted} new_term=${newTermId}`
    );
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[switchTerm] ERROR:', err);
    throw err;
  } finally {
    client.release();
  }
};

export const executePostFeesForNewTerm = async (
  client: pg.PoolClient,
  tenantId: number,
  newTermId: number
) => {
  const { tenantId: validatedTenantId, newTermId: validatedNewTermId } = SwitchTermSchema.parse({
    tenantId,
    newTermId,
  });

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
              AND COALESCE(s.enrollment_status, 'active') = 'active'
            AND NOT EXISTS (
                SELECT 1 FROM student_ledger sl
                WHERE sl.student_id = s.id
                  AND sl.term_id = $2
                  AND sl.entry_type = 'term_fee'
                  AND sl.tenant_id = $1
            );
        `;

  const result = await client.query(sql, [validatedTenantId, validatedNewTermId]);
  return { insertedCount: result.rowCount ?? 0 };
};

/** Recalculate term_outstanding_balances from ledger for one term. */
export const recalculateTermOutstandingBalances = async (
  client: pg.PoolClient,
  tenantId: number,
  termId: number
) => {
  const result = await client.query(
    `INSERT INTO term_outstanding_balances (tenant_id, term_id, student_id, outstanding_balance, calculated_at)
     SELECT sl.tenant_id, sl.term_id, sl.student_id,
            GREATEST(0, COALESCE(SUM(sl.debit), 0) - COALESCE(SUM(sl.credit), 0)),
            CURRENT_TIMESTAMP
     FROM student_ledger sl
     WHERE sl.tenant_id = $1 AND sl.term_id = $2
     GROUP BY sl.tenant_id, sl.term_id, sl.student_id
     ON CONFLICT (tenant_id, term_id, student_id)
     DO UPDATE SET
       outstanding_balance = EXCLUDED.outstanding_balance,
       calculated_at = EXCLUDED.calculated_at`,
    [tenantId, termId]
  );
  return { rowsUpdated: result.rowCount ?? 0 };
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
    const fullCurrentTerm =
      currentYear && !String(currentTerm).includes(String(currentYear))
        ? `${currentTerm} ${currentYear}`.trim()
        : String(currentTerm);

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
        `SELECT student_id, COALESCE(SUM(COALESCE(amount_paid, amount, 0)), 0)::numeric AS total_paid
         FROM payments
         WHERE tenant_id = $1 AND COALESCE(is_voided, false) = false
           AND (term = $2 OR term = $3 OR term LIKE $4 OR term LIKE $5)
         GROUP BY student_id`,
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
        await client.query(
          `INSERT INTO term_arrears (tenant_id, student_id, current_term, from_term, amount)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (tenant_id, student_id, current_term)
           DO UPDATE SET amount = EXCLUDED.amount, from_term = EXCLUDED.from_term`,
          [tenantId, s.id, fullCurrentTerm, prevTermLabel, unpaid]
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
      `SELECT sl.student_id, (${SQL_TRUE_OUTSTANDING})::numeric AS balance
       FROM student_ledger sl
       INNER JOIN terms tt ON tt.id = sl.term_id
       WHERE sl.tenant_id = $1
         AND (tt.academic_year_id < $2 OR (tt.academic_year_id = $2 AND tt.id < $3))
       GROUP BY sl.student_id
       HAVING (${SQL_TRUE_OUTSTANDING}) != 0`,
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
        await client.query(
          `INSERT INTO term_arrears (tenant_id, student_id, current_term, amount)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (tenant_id, student_id, current_term)
           DO UPDATE SET amount = EXCLUDED.amount`,
          [tenantId, studentId, fullCurrentTerm, balance]
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
