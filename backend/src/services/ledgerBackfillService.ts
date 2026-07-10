import { getClient, query } from '../db/connection.js';
import {
  resolveLedgerTermFromSettings,
  reconcileDuplicateLedgerTerms,
  repairMisplacedLedgerRowsByDescription,
} from './ledgerFinanceService.js';
import { beneficiaryAdjustedFee } from '../utils/beneficiaryFee.js';

export type LedgerBackfillResult = {
  paymentsAdded: number;
  termFeesAdded: number;
  studentsProcessed: number;
  message: string;
};

export async function repairPaymentAndLedgerTermAttribution(tenantId: number): Promise<number> {
  const paymentsRes = await query(
    `SELECT id, term, term_id
     FROM payments
     WHERE tenant_id = $1
       AND COALESCE(is_voided, false) = false
       AND TRIM(COALESCE(term, '')) <> ''`,
    [tenantId]
  );

  let fixed = 0;
  for (const pay of paymentsRes.rows) {
    const termLabel = String(pay.term || '').trim();
    if (!termLabel) continue;

    // Never reassign payments that already have a term_id (prevents Term 1 payments bleeding into Term 2).
    if (pay.term_id != null) continue;

    const yearMatch = termLabel.match(/\b(\d{4}(?:\/\d{4})?)\s*$/);
    const year = yearMatch ? yearMatch[1] : null;
    if (!year) continue;

    const resolved = await resolveLedgerTermFromSettings(tenantId, year, termLabel);
    if (!resolved) continue;

    await query(`UPDATE payments SET term_id = $1 WHERE id = $2 AND tenant_id = $3`, [
      resolved.termId,
      pay.id,
      tenantId,
    ]);
    await query(
      `UPDATE student_ledger SET term_id = $1, academic_year_id = $2
       WHERE tenant_id = $3 AND payment_id = $4`,
      [resolved.termId, resolved.academicYearId, tenantId, pay.id]
    );
    fixed++;
  }
  return fixed;
}

/** Move payments back to a closed term when mis-tagged on the current open term. */
export async function repairPaymentsMisassignedToCurrentTerm(tenantId: number): Promise<number> {
  const { resolveActiveLedgerTerm } = await import('./studentUnifiedBalanceService.js');
  const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
  if (!ledgerTermId) return 0;

  const paymentsRes = await query(
    `SELECT id, term, term_id
     FROM payments
     WHERE tenant_id = $1
       AND term_id = $2
       AND COALESCE(is_voided, false) = false
       AND TRIM(COALESCE(term, '')) <> ''`,
    [tenantId, ledgerTermId]
  );

  let fixed = 0;
  for (const pay of paymentsRes.rows) {
    const termLabel = String(pay.term || '').trim();
    const yearMatch = termLabel.match(/\b(\d{4}(?:\/\d{4})?)\s*$/);
    const year = yearMatch?.[1];
    if (!year) continue;

    const resolved = await resolveLedgerTermFromSettings(tenantId, year, termLabel);
    if (!resolved || resolved.termId === ledgerTermId) continue;

    const termStatusRes = await query(
      `SELECT status FROM terms WHERE id = $1 AND tenant_id = $2 LIMIT 1`,
      [resolved.termId, tenantId]
    );
    if (String(termStatusRes.rows[0]?.status || '') !== 'closed') continue;

    await query(`UPDATE payments SET term_id = $1 WHERE id = $2 AND tenant_id = $3`, [
      resolved.termId,
      pay.id,
      tenantId,
    ]);
    await query(
      `UPDATE student_ledger SET term_id = $1, academic_year_id = $2
       WHERE tenant_id = $3 AND payment_id = $4`,
      [resolved.termId, resolved.academicYearId, tenantId, pay.id]
    );
    fixed++;
  }
  return fixed;
}

export async function dedupeInflatedArrearsRows(tenantId: number): Promise<number> {
  const res = await query(
    `DELETE FROM student_ledger sl
     WHERE sl.tenant_id = $1
       AND sl.entry_type = 'arrears'
       AND (
         sl.description ILIKE 'Arrears from previous term%'
         OR sl.description ILIKE 'Balance carried forward%'
       )
       AND EXISTS (
         SELECT 1 FROM student_ledger keep
         WHERE keep.tenant_id = sl.tenant_id
           AND keep.student_id = sl.student_id
           AND keep.term_id = sl.term_id
           AND keep.entry_type = 'arrears'
           AND keep.id <> sl.id
           AND keep.description ILIKE '%brought forward from%'
       )
     RETURNING sl.id`,
    [tenantId]
  );
  return res.rowCount ?? 0;
}

export async function removeUnauthorizedTermFees(tenantId: number): Promise<number> {
  const { resolveActiveLedgerTerm } = await import('./studentUnifiedBalanceService.js');
  const { ledgerTermId } = await resolveActiveLedgerTerm(query, tenantId);
  if (!ledgerTermId) return 0;

  const res = await query(
    `DELETE FROM student_ledger sl
     USING students s
     WHERE sl.tenant_id = $1
       AND sl.student_id = s.id
       AND sl.term_id = $2
       AND sl.entry_type = 'term_fee'
       AND NOT EXISTS (
         SELECT 1 FROM ledger_fee_structures lfs
         WHERE lfs.tenant_id = sl.tenant_id
           AND lfs.term_id = sl.term_id
           AND lfs.class_id = s.class_assigned_id
       )
     RETURNING sl.id`,
    [tenantId, ledgerTermId]
  );
  return res.rowCount ?? 0;
}

/** Repairs attribution and payment credits — does NOT auto-bill term fees. */
export async function ensureTenantLedgerSynced(tenantId: number): Promise<void> {
  try {
    await reconcileDuplicateLedgerTerms(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] term reconcile failed (continuing):', err);
  }
  try {
    await repairMisplacedLedgerRowsByDescription(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] ledger row repair failed (continuing):', err);
  }
  try {
    await repairPaymentsMisassignedToCurrentTerm(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] payment term repair failed (continuing):', err);
  }
  try {
    await repairPaymentAndLedgerTermAttribution(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] payment repair failed (continuing):', err);
  }
  try {
    await dedupeInflatedArrearsRows(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] arrears dedupe failed (continuing):', err);
  }
  try {
    await removeUnauthorizedTermFees(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] unauthorized term fee cleanup failed (continuing):', err);
  }
  try {
    await syncMissingPaymentLedgerCredits(tenantId);
  } catch (err) {
    console.error('[ensureTenantLedgerSynced] payment sync failed (continuing):', err);
  }
}

export async function syncMissingPaymentLedgerCredits(tenantId: number): Promise<number> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const bulkRes = await client.query(
      `INSERT INTO student_ledger (
         tenant_id, student_id, academic_year_id, term_id, description, entry_type,
         debit, credit, payment_method, receipt_number, reference, payment_id, metadata
       )
       SELECT
         p.tenant_id, p.student_id, t.academic_year_id, p.term_id,
         'Payment recorded — Receipt #' || COALESCE(p.receipt_number, p.id::text) || ' (sync)',
         'payment', 0, p.amount, p.payment_method, p.receipt_number, p.receipt_number, p.id,
         jsonb_build_object('sync', true, 'paymentDate', p.payment_date)
       FROM payments p
       INNER JOIN terms t ON t.id = p.term_id AND t.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1
         AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
         AND p.term_id IS NOT NULL
         AND COALESCE(p.amount, 0) > 0
         AND NOT EXISTS (
           SELECT 1 FROM student_ledger sl WHERE sl.tenant_id = p.tenant_id AND sl.payment_id = p.id
         )`,
      [tenantId]
    );

    let paymentsAdded = bulkRes.rowCount ?? 0;

    const paymentsRes = await client.query(
      `SELECT p.id, p.student_id, p.amount, p.receipt_number, p.term, p.payment_method, p.payment_date
       FROM payments p
       WHERE p.tenant_id = $1
         AND COALESCE(p.is_voided, false) = false
         AND COALESCE(p.payment_category, 'term_fee') = 'term_fee'
         AND p.term_id IS NULL
       ORDER BY p.payment_date ASC, p.id ASC`,
      [tenantId]
    );

    for (const pay of paymentsRes.rows) {
      const termLabel = String(pay.term || '').trim();
      if (!termLabel) continue;

      const yearMatch = termLabel.match(/\b(\d{4}(?:\/\d{4})?)\s*$/);
      if (!yearMatch) continue;

      const resolved = await resolveLedgerTermFromSettings(tenantId, yearMatch[1], termLabel);
      if (!resolved) continue;

      const amount = parseFloat(pay.amount) || 0;
      if (amount <= 0) continue;

      const existing = await client.query(
        `SELECT id FROM student_ledger WHERE tenant_id = $1 AND payment_id = $2`,
        [tenantId, pay.id]
      );
      if (existing.rows.length > 0) continue;

      await client.query(
        `INSERT INTO student_ledger (
           tenant_id, student_id, academic_year_id, term_id, description, entry_type,
           debit, credit, payment_method, receipt_number, reference, payment_id, metadata
         ) VALUES ($1, $2, $3, $4, $5, 'payment', 0, $6, $7, $8, $8, $9, $10::jsonb)`,
        [
          tenantId,
          pay.student_id,
          resolved.academicYearId,
          resolved.termId,
          `Payment recorded — Receipt #${pay.receipt_number || pay.id} (sync)`,
          amount,
          pay.payment_method,
          pay.receipt_number,
          pay.id,
          JSON.stringify({ sync: true, paymentDate: pay.payment_date }),
        ]
      );
      await query(`UPDATE payments SET term_id = $1 WHERE id = $2 AND tenant_id = $3 AND term_id IS NULL`, [
        resolved.termId,
        pay.id,
        tenantId,
      ]);
      paymentsAdded++;
    }

    await client.query('COMMIT');
    return paymentsAdded;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

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
    await repairPaymentAndLedgerTermAttribution(tenantId);

    const bulkPayRes = await client.query(
      `INSERT INTO student_ledger (
         tenant_id, student_id, academic_year_id, term_id, description, entry_type,
         debit, credit, payment_method, receipt_number, reference, payment_id, created_by, metadata
       )
       SELECT
         p.tenant_id, p.student_id, t.academic_year_id, p.term_id,
         'Payment recorded — Receipt #' || COALESCE(p.receipt_number, p.id::text) || ' (backfill)',
         'payment', 0, p.amount, p.payment_method, p.receipt_number, p.receipt_number, p.id, $2,
         jsonb_build_object('backfill', true, 'paymentDate', p.payment_date)
       FROM payments p
       INNER JOIN terms t ON t.id = p.term_id AND t.tenant_id = p.tenant_id
       WHERE p.tenant_id = $1
         AND COALESCE(p.is_voided, false) = false
         AND p.term_id IS NOT NULL
         AND COALESCE(p.amount, 0) > 0
         AND NOT EXISTS (
           SELECT 1 FROM student_ledger sl WHERE sl.tenant_id = p.tenant_id AND sl.payment_id = p.id
         )`,
      [tenantId, createdByUserId ?? null]
    );
    paymentsAdded += bulkPayRes.rowCount ?? 0;

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
