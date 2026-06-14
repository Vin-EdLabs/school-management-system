import type pg from 'pg';
import { query, getClient } from '../db/connection.js';
import { getAccountBalanceForId } from './paymentAccountService.js';

export async function listFundTransfers(tenantId: number, limit = 50) {
  const result = await query(
    `SELECT ft.*,
            fa.account_name AS from_account_name, fa.account_type AS from_account_type,
            ta.account_name AS to_account_name, ta.account_type AS to_account_type,
            COALESCE(NULLIF(TRIM(u.full_name), ''), u.username) AS transferred_by_name
     FROM fund_transfers ft
     JOIN payment_accounts fa ON fa.id = ft.from_account_id
     JOIN payment_accounts ta ON ta.id = ft.to_account_id
     LEFT JOIN users u ON u.id = ft.transferred_by
     WHERE ft.tenant_id = $1
     ORDER BY ft.transfer_date DESC, ft.created_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return result.rows;
}

export async function createFundTransfer(
  tenantId: number,
  userId: number,
  input: { from_account_id: number; to_account_id: number; amount: number; transfer_date: string; note: string }
) {
  if (input.from_account_id === input.to_account_id) {
    throw new Error('Source and destination accounts must be different');
  }
  if (!input.note?.trim()) {
    throw new Error('Transfer note is mandatory');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Transfer amount must be greater than zero');
  }

  const sourceBalance = await getAccountBalanceForId(tenantId, input.from_account_id);
  if (sourceBalance == null) {
    throw new Error('Source account not found');
  }
  if (input.amount > sourceBalance + 0.001) {
    throw new Error(`Insufficient balance. Available: GHS ${sourceBalance.toFixed(2)}`);
  }

  const destCheck = await query(
    `SELECT id FROM payment_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true`,
    [input.to_account_id, tenantId]
  );
  if (destCheck.rows.length === 0) {
    throw new Error('Destination account not found');
  }

  const result = await query(
    `INSERT INTO fund_transfers (tenant_id, from_account_id, to_account_id, amount, transfer_date, note, transferred_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      tenantId,
      input.from_account_id,
      input.to_account_id,
      input.amount,
      input.transfer_date,
      input.note.trim(),
      userId,
    ]
  );
  return result.rows[0];
}

export async function reverseFundTransfer(tenantId: number, transferId: number, userId: number) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const origRes = await client.query(
      `SELECT * FROM fund_transfers WHERE id = $1 AND tenant_id = $2 FOR UPDATE`,
      [transferId, tenantId]
    );
    if (origRes.rows.length === 0) {
      throw new Error('Transfer not found');
    }
    const orig = origRes.rows[0];
    if (orig.is_reversed) {
      throw new Error('This transfer has already been reversed');
    }

    await client.query(
      `UPDATE fund_transfers SET is_reversed = true, reversed_by = $1, reversed_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, transferId]
    );

    const reversal = await client.query(
      `INSERT INTO fund_transfers (
         tenant_id, from_account_id, to_account_id, amount, transfer_date, note,
         transferred_by, original_transfer_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        tenantId,
        orig.to_account_id,
        orig.from_account_id,
        orig.amount,
        new Date().toISOString().slice(0, 10),
        `Reversal of transfer #${transferId}: ${orig.note || ''}`.trim(),
        userId,
        transferId,
      ]
    );

    await client.query('COMMIT');
    return { original: { ...orig, is_reversed: true }, reversal: reversal.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
