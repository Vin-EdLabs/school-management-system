import { getClient, query } from '../db/connection.js';
import { resolveLedgerTermFromSettings } from './ledgerFinanceService.js';
import { beneficiaryAdjustedFee } from '../utils/beneficiaryFee.js';

export type LedgerBackfillResult = {
  paymentsAdded: number;
  termFeesAdded: number;
  studentsProcessed: number;
  message: string;
};

/**
 * Backfill missing student_ledger entries from payments and ledger_fee_structures.
 * Idempotent — skips rows that already have a matching ledger entry.
 */
export async function runLedgerBackfill(
  tenantId: number,
  createdByUserId?: number
): Promise<LedgerBackfillResult> {
  const client = await getClient();
  let paymentsAdded = 0;
  let termFeesAdded = 0;
  let studentsProcessed = 0;

  try {
    await client.query('BEGIN');

    const settingsRes = await client.query(
      `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const currentTerm = settingsRes.rows[0]?.current_term;
    const currentYear = settingsRes.rows[0]?.current_year;

    // ── Backfill payment credits ─────────────────────────────────────────────
    const paymentsRes = await client.query(
      `SELECT p.id, p.student_id, p.amount, p.receipt_number, p.term, p.payment_method, p.payment_date
       FROM payments p
       WHERE p.tenant_id = $1 AND COALESCE(p.is_voided, false) = false
       ORDER BY p.payment_date ASC, p.id ASC`,
      [tenantId]
    );

    for (const pay of paymentsRes.rows) {
      const existing = await client.query(
        `SELECT id FROM student_ledger WHERE tenant_id = $1 AND payment_id = $2`,
        [tenantId, pay.id]
      );
      if (existing.rows.length > 0) continue;

      const termLabel = String(pay.term || '').trim();
      let resolved = null;
      if (termLabel) {
        const parts = termLabel.match(/^(.+?)\s+(\d{4})$/);
        const termName = parts ? parts[1] : termLabel;
        const year = parts ? parts[2] : currentYear;
        if (year) {
          resolved = await resolveLedgerTermFromSettings(tenantId, String(year), termName);
        }
      }
      if (!resolved && currentTerm && currentYear) {
        resolved = await resolveLedgerTermFromSettings(tenantId, String(currentYear), String(currentTerm));
      }
      if (!resolved) continue;

      const amount = parseFloat(pay.amount) || 0;
      if (amount <= 0) continue;

      await client.query(
        `INSERT INTO student_ledger (
           tenant_id, student_id, academic_year_id, term_id, description, entry_type,
           debit, credit, payment_method, receipt_number, reference, payment_id, created_by, metadata
         ) VALUES ($1, $2, $3, $4, $5, 'payment', 0, $6, $7, $8, $8, $9, $10, $11::jsonb)`,
        [
          tenantId,
          pay.student_id,
          resolved.academicYearId,
          resolved.termId,
          `Payment recorded — Receipt #${pay.receipt_number || pay.id} (backfill)`,
          amount,
          pay.payment_method,
          pay.receipt_number,
          pay.id,
          createdByUserId ?? null,
          JSON.stringify({ backfill: true, paymentDate: pay.payment_date }),
        ]
      );
      paymentsAdded++;
    }

    // ── Backfill term_fee debits from ledger_fee_structures ────────────────────
    const studentsRes = await client.query(
      `SELECT s.id, s.class_assigned_id, s.is_beneficiary, s.discount_type, s.discount_value
       FROM students s
       WHERE s.tenant_id = $1 AND COALESCE(s.enrollment_status, 'active') = 'active'`,
      [tenantId]
    );

    for (const student of studentsRes.rows) {
      studentsProcessed++;
      if (!student.class_assigned_id) continue;

      const feesRes = await client.query(
        `SELECT fs.academic_year_id, fs.term_id, fs.total, t.name AS term_name
         FROM ledger_fee_structures fs
         JOIN terms t ON t.id = fs.term_id
         WHERE fs.tenant_id = $1 AND fs.class_id = $2`,
        [tenantId, student.class_assigned_id]
      );

      for (const fee of feesRes.rows) {
        const existing = await client.query(
          `SELECT id FROM student_ledger
           WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND entry_type = 'term_fee'`,
          [tenantId, student.id, fee.term_id]
        );
        if (existing.rows.length > 0) continue;

        const { totalFees } = beneficiaryAdjustedFee(parseFloat(fee.total), student);
        await client.query(
          `INSERT INTO student_ledger (
             tenant_id, student_id, academic_year_id, term_id, description, entry_type,
             debit, credit, created_by, metadata
           ) VALUES ($1, $2, $3, $4, $5, 'term_fee', $6, 0, $7, $8::jsonb)`,
          [
            tenantId,
            student.id,
            fee.academic_year_id,
            fee.term_id,
            `Term fee for ${fee.term_name} (backfill)`,
            totalFees,
            createdByUserId ?? null,
            JSON.stringify({ backfill: true }),
          ]
        );
        termFeesAdded++;
      }
    }

    // Refresh term_arrears cache for legacy reports
    if (currentTerm) {
      const { refreshArrearsForTenantWithClient } = await import('./arrearsService.js');
      await refreshArrearsForTenantWithClient(
        client,
        tenantId,
        String(currentTerm),
        String(currentYear || '')
      );
    }

    await client.query('COMMIT');

    return {
      paymentsAdded,
      termFeesAdded,
      studentsProcessed,
      message: `Backfill complete: ${paymentsAdded} payment(s) and ${termFeesAdded} term fee(s) added to ledger.`,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
