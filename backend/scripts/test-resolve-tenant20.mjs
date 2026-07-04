import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { resolveLedgerTermFromSettings } = await import('../src/services/ledgerFinanceService.js');
const { resolveActiveLedgerTerm } = await import('../src/services/studentUnifiedBalanceService.js');
const { query } = await import('../src/db/connection.js');

const TENANT = 20;

const settings = await query('SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1', [TENANT]);
const { current_term, current_year } = settings.rows[0];

console.log('Settings:', { current_term, current_year });

const resolved = await resolveLedgerTermFromSettings(TENANT, String(current_year), String(current_term));
console.log('resolveLedgerTermFromSettings:', resolved);

const active = await resolveActiveLedgerTerm(query, TENANT);
console.log('resolveActiveLedgerTerm:', active);

if (resolved?.termId) {
  const ledger = await query(
    `SELECT COUNT(*) AS rows, COALESCE(SUM(debit),0) AS debit FROM student_ledger WHERE tenant_id=$1 AND term_id=$2`,
    [TENANT, resolved.termId]
  );
  console.log('Ledger at resolved term:', ledger.rows[0]);
}

process.exit(0);
