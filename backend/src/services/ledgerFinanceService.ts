import { query, getClient } from '../db/connection.js';
import type pg from 'pg';
import { beneficiaryAdjustedFee } from '../utils/beneficiaryFee.js';
import {
  SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE,
  SQL_FEE_STRUCTURE_CLASS_MATCH,
  SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM,
} from '../utils/feeStructureSql.js';
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
 * Prefers the terms row that actually has ledger/fee-structure data (avoids empty is_current duplicates).
 */
function extractTermOnly(termLabel: string): string {
  return String(termLabel || '')
    .replace(/\s+\d{4}(\/\d{4})?$/, '')
    .trim() || String(termLabel || '').trim();
}

function academicYearNameCandidates(year: string): string[] {
  const y = String(year || '').trim();
  if (!y) return [];
  const out = new Set<string>([y]);
  const slash = y.match(/^(\d{4})\s*\/\s*(\d{4})$/);
  if (slash) {
    out.add(`${slash[1]}/${slash[2]}`);
    out.add(slash[1]);
  } else {
    const one = y.match(/^(\d{4})$/);
    if (one) {
      const n = parseInt(one[1], 10);
      out.add(`${n}/${n + 1}`);
    }
  }
  return [...out];
}

async function resolveAcademicYearId(tenantId: number, year: string): Promise<number> {
  const candidates = academicYearNameCandidates(year);
  for (const name of candidates) {
    const row = await query(
      'SELECT id FROM academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1',
      [tenantId, name]
    );
    if (row.rows.length > 0) return Number(row.rows[0].id);
  }

  const normalized =
    candidates.find((c) => c.includes('/')) || candidates[0] || String(year).trim();
  const ins = await query(
    'INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id',
    [tenantId, normalized]
  );
  await query('UPDATE academic_years SET is_current = false WHERE tenant_id = $1 AND id != $2', [
    tenantId,
    ins.rows[0].id,
  ]);
  return Number(ins.rows[0].id);
}

const TERM_HAS_ACTIVITY_SQL = `
  (
    EXISTS (SELECT 1 FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id)
    OR EXISTS (SELECT 1 FROM ledger_fee_structures lfs WHERE lfs.term_id = t.id AND lfs.tenant_id = t.tenant_id)
    OR EXISTS (SELECT 1 FROM payments p WHERE p.term_id = t.id AND p.tenant_id = t.tenant_id)
  )
`;

const TERM_NOT_CLOSED_SQL = `COALESCE(t.status, 'active') NOT IN ('closed', 'closing') AND t.closed_at IS NULL`;

async function findLedgerTermWithPriority(
  tenantId: number,
  academicYearId: number,
  termLabel: string,
  termOnly: string
): Promise<number | null> {
  const likeTerm = `%${termOnly}%`;
  const likeFull = `%${termLabel}%`;

  const nameMatch = `(t.name = $3 OR t.name = $4 OR t.name ILIKE $5 OR t.name ILIKE $6)`;
  const baseParams = [tenantId, academicYearId, termLabel, termOnly, likeTerm, likeFull];

  const p1 = await query(
    `SELECT t.id FROM terms t
     WHERE t.tenant_id = $1 AND t.academic_year_id = $2
       AND t.is_current = true AND ${nameMatch}
       AND ${TERM_NOT_CLOSED_SQL}
       AND ${TERM_HAS_ACTIVITY_SQL}
     LIMIT 1`,
    baseParams
  );
  if (p1.rows.length > 0) return Number(p1.rows[0].id);

  const p2 = await query(
    `SELECT t.id FROM terms t
     WHERE t.tenant_id = $1 AND t.academic_year_id = $2
       AND ${nameMatch} AND ${TERM_NOT_CLOSED_SQL} AND ${TERM_HAS_ACTIVITY_SQL}
     ORDER BY t.id DESC
     LIMIT 1`,
    baseParams
  );
  if (p2.rows.length > 0) return Number(p2.rows[0].id);

  const p3 = await query(
    `SELECT t.id FROM terms t
     WHERE t.tenant_id = $1 AND t.academic_year_id = $2
       AND t.is_current = true AND ${nameMatch}
       AND ${TERM_NOT_CLOSED_SQL}
     LIMIT 1`,
    baseParams
  );
  if (p3.rows.length > 0) return Number(p3.rows[0].id);

  // Exact open name match (no cross-term fallback — never reuse another term's ledger).
  const p4 = await query(
    `SELECT t.id FROM terms t
     WHERE t.tenant_id = $1 AND t.academic_year_id = $2
       AND LOWER(TRIM(t.name)) = LOWER(TRIM($3))
       AND ${TERM_NOT_CLOSED_SQL}
     ORDER BY t.is_current DESC, t.id DESC
     LIMIT 1`,
    [tenantId, academicYearId, termOnly]
  );
  if (p4.rows.length > 0) return Number(p4.rows[0].id);

  return null;
}

/** Open ledger only — never reuse a closed term row for a new academic term. */
async function findSimilarLedgerTerm(
  tenantId: number,
  academicYearId: number,
  termLabel: string,
  termOnly: string
): Promise<number | null> {
  const likeTerm = `%${termOnly}%`;
  const res = await query(
    `SELECT id FROM terms t
     WHERE t.tenant_id = $1 AND t.academic_year_id = $2
       AND (t.name = $3 OR t.name = $4 OR t.name ILIKE $5 OR t.name ILIKE $6)
       AND ${TERM_NOT_CLOSED_SQL}
     ORDER BY t.is_current DESC, t.id DESC
     LIMIT 1`,
    [tenantId, academicYearId, termLabel, termOnly, likeTerm, `%${termLabel}%`]
  );
  return res.rows.length > 0 ? Number(res.rows[0].id) : null;
}

async function setCurrentLedgerTerm(tenantId: number, termId: number): Promise<void> {
  await query('UPDATE terms SET is_current = false WHERE tenant_id = $1', [tenantId]);
  await query('UPDATE terms SET is_current = true WHERE id = $1 AND tenant_id = $2', [termId, tenantId]);
}

export const resolveLedgerTermFromSettings = async (
  tenantId: number,
  currentYear: string,
  currentTerm: string
): Promise<{ academicYearId: number; termId: number } | null> => {
  const year = String(currentYear || '').trim();
  const termLabel = String(currentTerm || '').trim();
  if (!year || !termLabel) return null;

  const termOnly = extractTermOnly(termLabel);
  const yearCandidates = new Set([
    ...academicYearNameCandidates(year),
    ...academicYearNameCandidates(termLabel),
  ]);

  const activeAcademic = await query(
    `SELECT at.term_name, at.year, at.ledger_term_id
     FROM academic_terms at
     WHERE at.tenant_id = $1 AND at.is_active = true AND at.closed_at IS NULL
     LIMIT 1`,
    [tenantId]
  );
  if (activeAcademic.rows[0]?.ledger_term_id != null) {
    const row = activeAcademic.rows[0];
    const activeYear = String(row.year || '').trim();
    const activeTermOnly = extractTermOnly(String(row.term_name || '')).toLowerCase();
    const reqTermOnly = termOnly.toLowerCase();
    const activeYearCandidates = academicYearNameCandidates(activeYear);
    const yearMatches =
      yearCandidates.has(activeYear) ||
      activeYearCandidates.some((c) => yearCandidates.has(c)) ||
      year === activeYear;
    const termMatches =
      activeTermOnly === reqTermOnly ||
      termLabel.toLowerCase().includes(activeTermOnly) ||
      activeTermOnly.includes(reqTermOnly);
    if (yearMatches && termMatches) {
      const ledgerId = Number(row.ledger_term_id);
      const termMeta = await query(
        `SELECT t.academic_year_id, t.status, t.name, t.closed_at, ay.name AS year_name
         FROM terms t
         JOIN academic_years ay ON ay.id = t.academic_year_id
         WHERE t.id = $1 AND t.tenant_id = $2
         LIMIT 1`,
        [ledgerId, tenantId]
      );
      const meta = termMeta.rows[0];
      if (
        meta &&
        meta.closed_at == null &&
        String(meta.status || '') !== 'closed' &&
        String(meta.name || '').trim().toLowerCase() === termOnly.toLowerCase()
      ) {
        return {
          academicYearId: Number(meta.academic_year_id),
          termId: ledgerId,
        };
      }
    }
  }

  const academicYearId = await resolveAcademicYearId(tenantId, year);

  let termId = await findLedgerTermWithPriority(tenantId, academicYearId, termLabel, termOnly);

  if (!termId) {
    const existing = await findSimilarLedgerTerm(tenantId, academicYearId, termLabel, termOnly);
    if (existing) {
      termId = existing;
      await query(
        `UPDATE terms SET name = CASE
           WHEN name = $3 OR name = $4 THEN name
           ELSE $3
         END
         WHERE id = $1 AND tenant_id = $2`,
        [termId, tenantId, termOnly, termLabel]
      );
    }
  }

  // Closed (or missing) match → always create a fresh open ledger. Never reuse a closed id.
  if (termId) {
    const openCheck = await query(
      `SELECT id FROM terms t
       WHERE t.id = $1 AND t.tenant_id = $2 AND ${TERM_NOT_CLOSED_SQL}
       LIMIT 1`,
      [termId, tenantId]
    );
    if (!openCheck.rows.length) {
      termId = null;
    }
  }

  if (!termId) {
    const ins = await query(
      `INSERT INTO terms (tenant_id, academic_year_id, name, is_current, status)
       VALUES ($1, $2, $3, false, 'active') RETURNING id`,
      [tenantId, academicYearId, termOnly]
    );
    termId = Number(ins.rows[0].id);
  }

  const termMeta = await query(
    'SELECT academic_year_id FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1',
    [termId, tenantId]
  );
  const resolvedYearId = Number(termMeta.rows[0]?.academic_year_id) || academicYearId;

  return { academicYearId: resolvedYearId, termId };
};

/**
 * Merge ledger/fee data from duplicate terms into the canonical term for the active settings year.
 * Only merges TRUE duplicates: same academic year AND same term name.
 */
export async function reconcileDuplicateLedgerTerms(tenantId: number): Promise<{ merged: number; canonicalTermId: number | null }> {
  const settingsRes = await query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [tenantId]
  );
  const currentYear = String(settingsRes.rows[0]?.current_year || '').trim();
  const currentTerm = String(settingsRes.rows[0]?.current_term || '').trim();
  if (!currentYear || !currentTerm) return { merged: 0, canonicalTermId: null };

  const termOnly = extractTermOnly(currentTerm);
  const ayRes = await query(
    'SELECT id FROM academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1',
    [tenantId, currentYear]
  );
  if (ayRes.rows.length === 0) return { merged: 0, canonicalTermId: null };
  const ayId = Number(ayRes.rows[0].id);

  let canonical = await query(
    `SELECT id FROM terms WHERE tenant_id = $1 AND academic_year_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3)) LIMIT 1`,
    [tenantId, ayId, termOnly]
  );
  let canonicalId = canonical.rows[0]?.id ? Number(canonical.rows[0].id) : null;
  if (!canonicalId) {
    const ins = await query(
      `INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, false) RETURNING id`,
      [tenantId, ayId, termOnly]
    );
    canonicalId = Number(ins.rows[0].id);
  }

  const dupes = await query(
    `SELECT DISTINCT t.id
     FROM terms t
     WHERE t.tenant_id = $1
       AND t.id != $2
       AND t.academic_year_id = $3
       AND LOWER(TRIM(t.name)) = LOWER(TRIM($4))
       AND (
         EXISTS (SELECT 1 FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id)
         OR EXISTS (SELECT 1 FROM ledger_fee_structures lfs WHERE lfs.term_id = t.id AND lfs.tenant_id = t.tenant_id)
       )`,
    [tenantId, canonicalId, ayId, termOnly]
  );

  let merged = 0;
  for (const row of dupes.rows) {
    const fromId = Number(row.id);
    await query(
      `UPDATE student_ledger SET term_id = $1, academic_year_id = $2 WHERE tenant_id = $3 AND term_id = $4`,
      [canonicalId, ayId, tenantId, fromId]
    );
    await query(
      `UPDATE ledger_fee_structures SET term_id = $1, academic_year_id = $2 WHERE tenant_id = $3 AND term_id = $4`,
      [canonicalId, ayId, tenantId, fromId]
    );
    await query(`UPDATE payments SET term_id = $1 WHERE tenant_id = $2 AND term_id = $3`, [canonicalId, tenantId, fromId]);
    await query(`UPDATE invoices SET term_id = $1 WHERE tenant_id = $2 AND term_id = $3`, [canonicalId, tenantId, fromId]).catch(() => undefined);
    await query(`DELETE FROM terms WHERE id = $1 AND tenant_id = $2`, [fromId, tenantId]).catch(() => undefined);
    merged++;
  }

  if (merged > 0) {
    await setCurrentLedgerTerm(tenantId, canonicalId);
  }

  return { merged, canonicalTermId: canonicalId };
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
    try {
      await recalculateTermOutstandingBalances(null, validatedTenantId, validatedTermId);
    } catch (recalcErr) {
      console.error('[postFeesForClass] Outstanding balance recalc failed (non-fatal):', recalcErr);
    }
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

    await recalculateTermOutstandingBalances(client, tenantId, termId);
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
                (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}) as debit,
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

    try {
      await recalculateTermOutstandingBalances(null, validatedTenantId, validatedNewTermId);
    } catch (recalcErr) {
      console.error('[postFeesForNewTerm] Outstanding balance recalc failed (non-fatal):', recalcErr);
    }

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
  repairedCount: number;
}> {
  const settingsRes = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term;
  const currentYear = settingsRes.rows[0]?.current_year;
  if (!currentTerm || !currentYear) {
    return { termId: null, insertedCount: 0, repairedCount: 0 };
  }

  const resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
  if (!resolved) {
    return { termId: null, insertedCount: 0, repairedCount: 0 };
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
        (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}),
        0
      FROM students s
      INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
      INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
      ${SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM}
      WHERE s.tenant_id = $1
        AND (${SQL_FEE_STRUCTURE_CLASS_MATCH})
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

    const repairSql = `
      UPDATE student_ledger sl
      SET debit = sub.net_fee
      FROM (
        SELECT DISTINCT ON (s.id)
          s.id AS student_id,
          (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}) AS net_fee
        FROM students s
        INNER JOIN terms t ON t.id = $2 AND t.tenant_id = $1
        INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
        ${SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM}
        WHERE s.tenant_id = $1
          AND (${SQL_FEE_STRUCTURE_CLASS_MATCH})
          AND COALESCE(s.enrollment_status, 'active') = 'active'
          AND s.class_assigned_id IS NOT NULL
        ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
      ) sub
      WHERE sl.tenant_id = $1
        AND sl.student_id = sub.student_id
        AND sl.term_id = $2
        AND sl.entry_type = 'term_fee'
        AND sl.debit = 0
        AND sub.net_fee > 0
    `;

    const repairResult = await client.query(repairSql, [tenantId, resolved.termId]);
    await recalculateTermOutstandingBalances(client, tenantId, resolved.termId);
    await client.query('COMMIT');

    const insertedCount = result.rowCount ?? 0;
    const repairedCount = repairResult.rowCount ?? 0;
    if (insertedCount > 0 || repairedCount > 0) {
      console.log(
        `[syncMissingLedgerTermFees] Tenant ${tenantId}: inserted ${insertedCount}, repaired ${repairedCount} term_fee row(s) for term ${resolved.termId}`
      );
    }

    return { termId: resolved.termId, insertedCount, repairedCount };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[syncMissingLedgerTermFees] Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

/** Recalculate term_fee debit for one student when beneficiary discount changes. */
export async function syncBeneficiaryLedgerDebitsForStudent(
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<number> {
  const params: unknown[] = [tenantId, studentId];
  let termFilter = '';
  if (termId != null && !Number.isNaN(Number(termId))) {
    termFilter = 'AND t.id = $3';
    params.push(termId);
  }

  const result = await query(
    `UPDATE student_ledger sl
     SET debit = sub.net_fee
     FROM (
       SELECT DISTINCT ON (s.id, t.id)
         s.id AS student_id,
         t.id AS term_id,
         (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()})::numeric AS net_fee
       FROM students s
       INNER JOIN terms t ON t.tenant_id = s.tenant_id ${termFilter}
       INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
       ${SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM}
       WHERE s.tenant_id = $1
         AND s.id = $2
         AND s.is_beneficiary = true
         AND (${SQL_FEE_STRUCTURE_CLASS_MATCH})
       ORDER BY s.id, t.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
     ) sub
     WHERE sl.tenant_id = $1
       AND sl.student_id = sub.student_id
       AND sl.term_id = sub.term_id
       AND sl.entry_type = 'term_fee'
       AND sl.debit IS DISTINCT FROM sub.net_fee`,
    params
  );

  return result.rowCount ?? 0;
}

export async function recalculateStudentTermFeeForActiveTerm(
  tenantId: number,
  studentId: number
): Promise<{ updated: boolean; termId: number | null }> {
  const settingsRes = await query(
    `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  const currentTerm = settingsRes.rows[0]?.current_term;
  const currentYear = settingsRes.rows[0]?.current_year;
  if (!currentTerm || !currentYear) {
    return { updated: false, termId: null };
  }

  const resolved = await resolveLedgerTermFromSettings(
    tenantId,
    String(currentYear),
    String(currentTerm)
  );
  if (!resolved) {
    return { updated: false, termId: null };
  }

  const result = await query(
    `UPDATE student_ledger sl
     SET debit = sub.net_fee
     FROM (
       SELECT DISTINCT ON (s.id)
         s.id AS student_id,
         (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()})::numeric AS net_fee
       FROM students s
       INNER JOIN terms t ON t.id = $3 AND t.tenant_id = $1
       INNER JOIN classes c_student ON c_student.id = s.class_assigned_id AND c_student.tenant_id = s.tenant_id
       ${SQL_JOIN_LEDGER_FEE_STRUCTURES_FOR_TERM}
       WHERE s.tenant_id = $1
         AND s.id = $2
         AND (${SQL_FEE_STRUCTURE_CLASS_MATCH})
       ORDER BY s.id, (fs.class_id = s.class_assigned_id) DESC, fs.id
     ) sub
     WHERE sl.tenant_id = $1
       AND sl.student_id = sub.student_id
       AND sl.term_id = $3
       AND sl.entry_type = 'term_fee'`,
    [tenantId, studentId, resolved.termId]
  );

  return { updated: (result.rowCount ?? 0) > 0, termId: resolved.termId };
}

/**
 * Carry forward closing balances when switching terms.
 * Does NOT post term_fee — billing requires explicit fee structure assignment per term.
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
    const prevStatusRes = await client.query(
      `SELECT status FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [prevTermId, tid]
    );
    const prevTermClosed = String(prevStatusRes.rows[0]?.status || '') === 'closed';
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

    type ClosingRow = { student_id: number; closing_balance: string | number };
    let closingRows: ClosingRow[];

    if (prevTermClosed) {
      const snapshotRes = await client.query(
        `SELECT student_id, carried_balance AS closing_balance
         FROM term_closing_balances
         WHERE tenant_id = $1 AND term_id = $2 AND carried_balance > 0`,
        [tid, prevTermId]
      );
      closingRows = snapshotRes.rows as ClosingRow[];
    } else {
      const closingRes = await client.query(
        `SELECT student_id,
                COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) AS closing_balance
         FROM student_ledger
         WHERE tenant_id = $1 AND term_id = $2
         GROUP BY student_id
         HAVING COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) != 0`,
        [tid, prevTermId]
      );
      closingRows = closingRes.rows as ClosingRow[];
    }

    let arrearsInserted = 0;
    let creditsCarried = 0;
    let totalApplied = 0;
    let totalCreditApplied = 0;

    for (const row of closingRows) {
      const studentId = Number(row.student_id);
      if (fullWaiverStudentIds.has(studentId)) continue;

      const closingBalance = roundMoney(parseFloat(String(row.closing_balance)) || 0);
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

        const prevCloseExists = await client.query(
          `SELECT id FROM student_ledger
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
             AND entry_type = 'carry_forward_debit'
             AND description LIKE $4
           LIMIT 1`,
          [tid, studentId, prevTermId, `%Term closed%`]
        );
        if (prevCloseExists.rows.length === 0) {
          await client.query(
            `INSERT INTO student_ledger
               (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit, metadata)
             VALUES ($1, $2, $3, $4, $5, 'carry_forward_debit', $6, 0, $7::jsonb)`,
            [
              tid,
              studentId,
              prevTerm.academic_year_id,
              prevTermId,
              `Term closed — credit carried to next term`,
              creditAmount,
              JSON.stringify({ carried_to_term_id: nextTermId, amount: creditAmount }),
            ]
          );
        }

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

        const prevCloseExists = await client.query(
          `SELECT id FROM student_ledger
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3
             AND entry_type = 'carry_forward_credit'
             AND description LIKE $4
           LIMIT 1`,
          [tid, studentId, prevTermId, `%Term closed%`]
        );
        if (prevCloseExists.rows.length === 0) {
          await client.query(
            `INSERT INTO student_ledger
               (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit, metadata)
             VALUES ($1, $2, $3, $4, $5, 'carry_forward_credit', 0, $6, $7::jsonb)`,
            [
              tid,
              studentId,
              prevTerm.academic_year_id,
              prevTermId,
              `Term closed — balance carried to next term`,
              arrearsAmount,
              JSON.stringify({ carried_to_term_id: nextTermId, amount: arrearsAmount }),
            ]
          );
        }

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

    return {
      message:
        `Balances carried forward. Arrears: ${arrearsInserted} students (GH₵${totalApplied.toFixed(2)}). ` +
        `Credits: ${creditsCarried} students (GH₵${totalCreditApplied.toFixed(2)}). ` +
        `Term fees were not billed — assign fee structures for this term first.`,
      arrearsRowsInserted: arrearsInserted,
      creditRowsInserted: creditsCarried,
      termFeesInserted: 0,
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
                (${SQL_BENEFICIARY_TERM_FEE_DEBIT_EFFECTIVE.trim()}) as debit,
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
  client: pg.PoolClient | null,
  tenantId: number,
  termId: number
) => {
  const run = client ? client.query.bind(client) : query;
  const result = await run(
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

/** Move ledger rows to the term implied by their description (repairs bad merges). */
export async function repairMisplacedLedgerRowsByDescription(tenantId: number): Promise<number> {
  const rowsRes = await query(
    `SELECT sl.id, sl.term_id, sl.description, sl.entry_type,
            ay.name AS current_year
     FROM student_ledger sl
     JOIN terms t ON t.id = sl.term_id AND t.tenant_id = sl.tenant_id
     JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE sl.tenant_id = $1
       AND sl.entry_type IN ('term_fee', 'payment')
       AND (sl.description ILIKE 'Term Fee - %' OR sl.description ILIKE 'Term fee for %')`,
    [tenantId]
  );

  let fixed = 0;
  for (const row of rowsRes.rows) {
    const desc = String(row.description || '');
    const feeMatch = desc.match(/Term [Ff]ee(?: for)? -?\s*(.+)$/i) || desc.match(/Term fee for (.+?) \(backfill\)/i);
    if (!feeMatch) continue;
    const termHint = feeMatch[1].trim();
    const yearMatch = termHint.match(/\b(\d{4}(?:\/\d{4})?)\s*$/);
    const year = yearMatch ? yearMatch[1] : String(row.current_year || '').trim();
    if (!year) continue;

    const resolved = await resolveLedgerTermFromSettings(tenantId, year, termHint);
    if (!resolved || resolved.termId === Number(row.term_id)) continue;

    await query(
      `UPDATE student_ledger SET term_id = $1, academic_year_id = $2 WHERE id = $3 AND tenant_id = $4`,
      [resolved.termId, resolved.academicYearId, row.id, tenantId]
    );
    fixed++;
  }
  return fixed;
}

/**
 * Backfill arrears for the current term — per-term carry only (not cumulative).
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

    const prevTermResult = await client.query(
      `SELECT t.id
       FROM terms t
       WHERE t.tenant_id = $1
         AND t.id != $2
         AND (t.academic_year_id < $3 OR (t.academic_year_id = $3 AND t.id < $2))
       ORDER BY t.academic_year_id DESC, t.id DESC
       LIMIT 1`,
      [tenantId, newTermId, newAyId]
    );

    if (prevTermResult.rows.length === 0) {
      await client.query('COMMIT');
      return {
        message: 'No previous ledger term found. Nothing to backfill.',
        studentsProcessed: 0,
        arrearsRowsInserted: 0,
        creditRowsInserted: 0,
      };
    }

    const prevTermId = Number(prevTermResult.rows[0].id);
    const result = await executeTermSwitchWithArrears(client, tenantId, prevTermId, newTermId);

    await client.query('COMMIT');
    return {
      message: result.message,
      studentsProcessed: (result.arrearsRowsInserted ?? 0) + (result.creditRowsInserted ?? 0),
      arrearsRowsInserted: result.arrearsRowsInserted ?? 0,
      creditRowsInserted: result.creditRowsInserted ?? 0,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
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
