import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import { resolveActiveLedgerTerm } from './studentUnifiedBalanceService.js';
import { getStudentBalanceFromLedger } from './ledgerBalanceService.js';
import { sendPushToStudentParents } from './webPushService.js';

type QueryFn = typeof query;

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export type StudentChargeRow = {
  id: number;
  tenantId: number;
  studentId: number;
  academicYearId: number;
  termId: number;
  description: string;
  amount: number;
  reason: string | null;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string;
  status: 'unpaid' | 'paid';
  paidAt: string | null;
  ledgerEntryId: number | null;
  paymentId: number | null;
};

function mapChargeRow(row: Record<string, unknown>): StudentChargeRow {
  return {
    id: Number(row.id),
    tenantId: Number(row.tenant_id),
    studentId: Number(row.student_id),
    academicYearId: Number(row.academic_year_id),
    termId: Number(row.term_id),
    description: String(row.description || ''),
    amount: roundMoney(parseFloat(String(row.amount)) || 0),
    reason: row.reason != null ? String(row.reason) : null,
    createdByUserId: row.created_by_user_id != null ? Number(row.created_by_user_id) : null,
    createdByName: row.created_by_name != null ? String(row.created_by_name) : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || ''),
    status: String(row.status || 'unpaid') === 'paid' ? 'paid' : 'unpaid',
    paidAt:
      row.paid_at instanceof Date
        ? row.paid_at.toISOString()
        : row.paid_at != null
          ? String(row.paid_at)
          : null,
    ledgerEntryId: row.ledger_entry_id != null ? Number(row.ledger_entry_id) : null,
    paymentId: row.payment_id != null ? Number(row.payment_id) : null,
  };
}

export async function listStudentCharges(
  tenantId: number,
  studentId: number,
  termId?: number | null
): Promise<StudentChargeRow[]> {
  const params: unknown[] = [tenantId, studentId];
  let termFilter = '';
  if (termId != null && !Number.isNaN(Number(termId))) {
    termFilter = 'AND sc.term_id = $3';
    params.push(termId);
  }

  const res = await query(
    `SELECT sc.*,
            COALESCE(u.full_name, u.username) AS created_by_name
     FROM student_charges sc
     LEFT JOIN users u ON u.id = sc.created_by_user_id
     WHERE sc.tenant_id = $1 AND sc.student_id = $2
       ${termFilter}
     ORDER BY sc.created_at ASC, sc.id ASC`,
    params
  );

  return res.rows.map((row) => mapChargeRow(row));
}

export async function getStudentChargesTotal(
  client: pg.PoolClient | null,
  tenantId: number,
  studentId: number,
  termId: number
): Promise<number> {
  const run: QueryFn = client ? client.query.bind(client) : query;
  const res = await run(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM student_charges
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3`,
    [tenantId, studentId, termId]
  );
  return roundMoney(parseFloat(String(res.rows[0]?.total)) || 0);
}

export async function createStudentCharge(input: {
  tenantId: number;
  studentId: number;
  description: string;
  amount: number;
  reason?: string | null;
  createdByUserId: number;
}): Promise<StudentChargeRow> {
  const amount = roundMoney(Number(input.amount));
  if (amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }
  const description = String(input.description || '').trim();
  if (!description) {
    throw new Error('Charge description is required.');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    const studentRes = await client.query(
      `SELECT id, first_name, last_name, student_id AS student_number,
              COALESCE(enrollment_status, 'active') AS enrollment_status
       FROM students
       WHERE id = $1 AND tenant_id = $2`,
      [input.studentId, input.tenantId]
    );
    if (studentRes.rows.length === 0) {
      throw new Error('Student not found.');
    }
    if (String(studentRes.rows[0].enrollment_status) !== 'active') {
      throw new Error('Charges can only be added for active students.');
    }

    const { ledgerTermId, academicYearId, termLabel } = await resolveActiveLedgerTerm(
      client.query.bind(client),
      input.tenantId
    );
    if (!ledgerTermId || !academicYearId || !termLabel) {
      throw new Error('No active term configured. Set the current term in School Settings first.');
    }

    const chargeRes = await client.query(
      `INSERT INTO student_charges (
         tenant_id, student_id, academic_year_id, term_id,
         description, amount, reason, created_by_user_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'unpaid')
       RETURNING *`,
      [
        input.tenantId,
        input.studentId,
        academicYearId,
        ledgerTermId,
        description,
        amount,
        input.reason?.trim() || null,
        input.createdByUserId,
      ]
    );

    const charge = chargeRes.rows[0];
    const chargeId = Number(charge.id);

    const ledgerRes = await client.query(
      `INSERT INTO student_ledger (
         tenant_id, student_id, academic_year_id, term_id,
         description, entry_type, debit, credit, created_by, metadata
       ) VALUES ($1, $2, $3, $4, $5, 'student_charge', $6, 0, $7, $8::jsonb)
       RETURNING id`,
      [
        input.tenantId,
        input.studentId,
        academicYearId,
        ledgerTermId,
        description,
        amount,
        input.createdByUserId,
        JSON.stringify({ student_charge_id: chargeId, reason: input.reason?.trim() || null }),
      ]
    );

    const ledgerEntryId = Number(ledgerRes.rows[0].id);
    await client.query(
      `UPDATE student_charges SET ledger_entry_id = $1 WHERE id = $2 AND tenant_id = $3`,
      [ledgerEntryId, chargeId, input.tenantId]
    );

    await client.query('COMMIT');

    const studentName = `${studentRes.rows[0].first_name} ${studentRes.rows[0].last_name}`.trim();
    await sendPushToStudentParents(input.tenantId, input.studentId, {
      title: 'New Charge Added to Account',
      body: `A charge of GHS ${amount.toFixed(2)} has been added to ${studentName}'s ${termLabel} account: ${description}. Please visit the finance office or log in to view your full statement.`,
      url: '?tab=finance',
    }).catch(() => {});

    const rows = await listStudentCharges(input.tenantId, input.studentId, ledgerTermId);
    const created = rows.find((r) => r.id === chargeId);
    if (!created) {
      throw new Error('Charge created but could not be loaded.');
    }
    return created;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteStudentCharge(
  tenantId: number,
  chargeId: number
): Promise<void> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const chargeRes = await client.query(
      `SELECT * FROM student_charges WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [chargeId, tenantId]
    );
    if (chargeRes.rows.length === 0) {
      throw new Error('Charge not found.');
    }
    const charge = chargeRes.rows[0];
    if (String(charge.status) === 'paid') {
      throw new Error('Paid charges cannot be removed.');
    }

    if (charge.ledger_entry_id != null) {
      await client.query(
        `DELETE FROM student_ledger
         WHERE id = $1 AND tenant_id = $2 AND entry_type = 'student_charge'`,
        [charge.ledger_entry_id, tenantId]
      );
    }

    await client.query(`DELETE FROM student_charges WHERE id = $1 AND tenant_id = $2`, [
      chargeId,
      tenantId,
    ]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * After a payment, mark individual charges paid:
 * standard fees (term_fee + arrears) are covered first, then charges oldest-first.
 */
export async function markStudentChargesPaidAfterPayment(
  client: pg.PoolClient,
  tenantId: number,
  studentId: number,
  termId: number,
  paymentId: number | null,
  totalPaidAfter: number
): Promise<void> {
  const balance = await getStudentBalanceFromLedger(client, tenantId, studentId, termId);
  const standardTotal = roundMoney(balance.termFee + balance.arrears);

  const chargesRes = await client.query(
    `SELECT id, amount FROM student_charges
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND status = 'unpaid'
     ORDER BY created_at ASC, id ASC`,
    [tenantId, studentId, termId]
  );

  if (chargesRes.rows.length === 0) return;

  let poolForCharges = roundMoney(Math.max(0, totalPaidAfter - standardTotal));
  if (poolForCharges <= 0) return;

  for (const row of chargesRes.rows) {
    const chargeAmount = roundMoney(parseFloat(String(row.amount)) || 0);
    if (poolForCharges + 0.001 < chargeAmount) break;

    await client.query(
      `UPDATE student_charges
       SET status = 'paid', paid_at = CURRENT_TIMESTAMP, payment_id = $1
       WHERE id = $2 AND tenant_id = $3`,
      [paymentId, row.id, tenantId]
    );
    poolForCharges = roundMoney(poolForCharges - chargeAmount);
  }
}

export async function markAllUnpaidChargesPaidForTerm(
  client: pg.PoolClient,
  tenantId: number,
  studentId: number,
  termId: number,
  paymentId: number | null
): Promise<void> {
  await client.query(
    `UPDATE student_charges
     SET status = 'paid', paid_at = CURRENT_TIMESTAMP, payment_id = COALESCE($4, payment_id)
     WHERE tenant_id = $1 AND student_id = $2 AND term_id = $3 AND status = 'unpaid'`,
    [tenantId, studentId, termId, paymentId]
  );
}
