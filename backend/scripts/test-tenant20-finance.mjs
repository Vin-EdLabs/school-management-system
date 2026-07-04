import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const { query } = await import('../src/db/connection.js');
const { resolveActiveLedgerTerm } = await import('../src/services/studentUnifiedBalanceService.js');
const { getOutstandingFeesFromLedger, getBatchStudentBalancesFromLedger } = await import('../src/services/ledgerBalanceService.js');
const { SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE } = await import('../src/utils/feeStructureSql.js');
const { generateBulkInvoices } = await import('../src/services/invoiceService.js');

const TENANT = 20;

const active = await resolveActiveLedgerTerm(query, TENANT);
console.log('Active term:', active);

const termId = active.ledgerTermId;
if (!termId) { console.error('No ledger term'); process.exit(1); }

const outstanding = await getOutstandingFeesFromLedger(null, TENANT, termId, null);
console.log('\nOutstanding fees:', outstanding);

const balances = await getBatchStudentBalancesFromLedger(null, TENANT, termId, null);
console.log('\nStudent balances:', balances);

const feeTotals = await query(
  `WITH ${SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE}
   SELECT
     COALESCE(SUM(COALESCE(slt.term_fee, 0) + COALESCE(slt.arrears_amt, 0)), 0)::numeric AS total_expected,
     COALESCE(SUM(COALESCE(slt.paid_amt, 0)), 0)::numeric AS total_collected,
     COALESCE(SUM(COALESCE(slt.outstanding_amt, 0)), 0)::numeric AS total_outstanding
   FROM students s
   LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
   WHERE s.tenant_id = $1 AND COALESCE(s.enrollment_status, 'active') = 'active'`,
  [TENANT, termId]
);
console.log('\nFinancial summary totals:', feeTotals.rows[0]);

const invoices = await generateBulkInvoices(TENANT, { termId });
console.log('\nInvoice generation:', {
  generated: invoices.generated,
  skipped: invoices.skipped,
  totalInvoicedAmount: invoices.totalInvoicedAmount,
});

process.exit(0);
