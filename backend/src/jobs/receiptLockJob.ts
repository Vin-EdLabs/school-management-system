import { query } from '../db/connection.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function lockExpiredReceipts(): Promise<number> {
  try {
    const result = await query(
      `UPDATE payments
       SET is_locked = true, locked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE COALESCE(is_locked, false) = false
         AND COALESCE(is_voided, false) = false
         AND created_at < (CURRENT_TIMESTAMP - INTERVAL '7 days')
       RETURNING id`
    );
    const count = result.rowCount ?? result.rows.length;
    if (count > 0) {
      console.log(`🔒 Locked ${count} receipt(s) older than 7 days`);
    }
    return count;
  } catch (err: any) {
    console.warn('Receipt lock job warning:', err?.message || err);
    return 0;
  }
}

export function startReceiptLockJob(): void {
  void lockExpiredReceipts();
  setInterval(() => {
    void lockExpiredReceipts();
  }, ONE_DAY_MS);
}
