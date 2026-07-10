import 'dotenv/config';
import { query } from '../src/db/connection.js';
import { resolveLedgerTermFromSettings } from '../src/services/ledgerFinanceService.js';
import { SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE } from '../src/utils/feeStructureSql.js';

const tenantId = 20;
const resolved = await resolveLedgerTermFromSettings(tenantId, '2028', 'TERM 3 2028');
console.log('resolved ledger:', resolved);

const ledgerTermId = resolved?.termId ?? 62;
const r = await query(
  `WITH ${SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE}
   SELECT s.id, s.first_name, s.last_name, slt.*
   FROM students s
   LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
   WHERE s.tenant_id = $1`,
  [tenantId, ledgerTermId]
);
console.log('dashboard totals:', r.rows);

const fin = await query(
  `WITH ${SQL_EFFECTIVE_STUDENT_LEDGER_TOTALS_CTE}
   SELECT
     COALESCE(SUM(COALESCE(slt.term_fee, 0) + COALESCE(slt.arrears_amt, 0)), 0)::numeric AS total_expected,
     COALESCE(SUM(COALESCE(slt.outstanding_amt, 0)), 0)::numeric AS total_outstanding
   FROM students s
   LEFT JOIN student_ledger_totals slt ON slt.student_id = s.id
   WHERE s.tenant_id = $1 AND COALESCE(s.enrollment_status, 'active') = 'active'`,
  [tenantId, ledgerTermId]
);
console.log('financial summary fees:', fin.rows[0]);

process.exit(0);
