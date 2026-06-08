/**
 * @file This file contains the core business logic for the new, cumulative ledger-based finance system.
 * It is designed to be immutable, ensuring that financial records are never lost or overwritten.
 * Arrears and credits are automatically carried over between terms because the balance is always
 * calculated as a sum of all historical transactions.
 */

import { query, getClient } from '../db/connection.js';
import { z } from 'zod';

// ==================================================================================================
// CUMULATIVE BALANCE CALCULATION
// This is the single source of truth for a student's balance.
// It sums ALL debits and credits for a student, across ALL terms and years.
// This is how arrears and credits are automatically carried forward.
// ==================================================================================================
const CUMULATIVE_BALANCE_SQL = `
  SELECT
    COALESCE(SUM(debit), 0) AS total_debit,
    COALESCE(SUM(credit), 0) AS total_credit,
    (COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) AS balance
  FROM student_ledger
  WHERE tenant_id = $1 AND student_id = $2;
`;

// Zod schemas for validation
const StudentSummarySchema = z.object({ tenantId: z.number().int(), studentId: z.number().int() });
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
const PostFeesSchema = z.object({
  tenantId: z.number().int(),
  classId: z.number().int(),
  academicYearId: z.number().int(),
  termId: z.number().int(),
});
const SwitchTermSchema = z.object({ tenantId: z.number().int(), newTermId: z.number().int() });

/**
 * Fetches a student's complete financial summary.
 * The balance calculated is ALWAYS cumulative.
 */
export const getStudentFinancialSummary = async (tenantId: number, studentId: number) => {
  const { tenantId: validatedTenantId, studentId: validatedStudentId } = StudentSummarySchema.parse({ tenantId, studentId });

  const balanceResult = await query(CUMULATIVE_BALANCE_SQL, [validatedTenantId, validatedStudentId]);
  const balanceData = balanceResult.rows[0];

  const ledgerHistoryResult = await query(
    'SELECT * FROM student_ledger WHERE tenant_id = $1 AND student_id = $2 ORDER BY created_at ASC',
    [validatedTenantId, validatedStudentId]
  );

  const balance = parseFloat(balanceData.balance);
  const status = balance > 0 ? 'owing' : balance < 0 ? 'credit' : 'cleared';

  return {
    total_debit: parseFloat(balanceData.total_debit),
    total_credit: parseFloat(balanceData.total_credit),
    balance,
    status,
    history: ledgerHistoryResult.rows,
  };
};

/**
 * Records a single payment for a student.
 * This adds a new CREDIT row to the student's ledger.
 */
export const recordStudentPayment = async (paymentData: z.infer<typeof PaymentSchema>) => {
    const validatedData = PaymentSchema.parse(paymentData);
    const { tenantId, studentId, academicYearId, termId, amount, description, paymentMethod, receiptNumber } = validatedData;
    
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await client.query(
            `INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, debit, credit, entry_type, payment_method, receipt_number)
             VALUES ($1, $2, $3, $4, $5, 0, $6, 'payment', $7, $8) RETURNING *`,
            [tenantId, studentId, academicYearId, termId, description || 'Payment', amount, paymentMethod, receiptNumber]
        );
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw new Error('Failed to record payment. Transaction rolled back.');
    } finally {
        client.release();
    }
};

/**
 * Automatically posts term fees for ALL students in a tenant for a new term.
 * This function is called when the school switches to a new term in the settings.
 * It uses a bulk insert command for efficiency and safety.
 */
export const postFeesForNewTermSwitch = async (tenantId: number, newTermId: number) => {
    const { tenantId: validatedTenantId, newTermId: validatedNewTermId } = SwitchTermSchema.parse({ tenantId, newTermId });

    console.log(`[postFeesForNewTermSwitch] Starting bulk fee posting for Tenant: ${validatedTenantId}, New Term: ${validatedNewTermId}`);

    const client = await getClient();
    try {
        await client.query('BEGIN');

        // This SQL query performs the bulk insert.
        // It finds all students who do NOT have a 'term_fee' entry for the new term
        // and inserts a new debit row for them based on their class's fee structure.
        const sql = `
            INSERT INTO student_ledger (tenant_id, student_id, academic_year_id, term_id, description, entry_type, debit, credit)
            SELECT
                s.tenant_id,
                s.id as student_id,
                t.academic_year_id,
                t.id as term_id,
                'Term Fee - ' || t.name as description,
                'term_fee' as entry_type,
                fs.total as debit,
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

        console.log(`[postFeesForNewTermSwitch] Completed. Inserted ${result.rowCount} new term fee entries.`);
        return {
            message: `Successfully posted fees for the new term for all eligible students.`,
            insertedCount: result.rowCount,
        };

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[postFeesForNewTermSwitch] Error:', error);
        throw new Error('Failed to post fees for the new term. Transaction rolled back.');
    } finally {
        client.release();
    }
};
