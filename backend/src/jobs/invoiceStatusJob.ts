import { query } from '../db/connection.js';
import { syncInvoiceStatuses } from '../services/invoiceService.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function syncAllInvoiceStatuses(): Promise<number> {
  try {
    const tenants = await query(`SELECT id FROM tenants WHERE COALESCE(is_active, true) = true`);
    let total = 0;
    for (const row of tenants.rows) {
      total += await syncInvoiceStatuses(Number(row.id));
    }
    if (total > 0) {
      console.log(`📄 Synced invoice statuses for ${total} invoice(s)`);
    }
    return total;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('Invoice status job warning:', msg);
    return 0;
  }
}

export function startInvoiceStatusJob(): void {
  void syncAllInvoiceStatuses();
  setInterval(() => {
    void syncAllInvoiceStatuses();
  }, ONE_DAY_MS);
}
