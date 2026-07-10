import 'dotenv/config';
import pg from 'pg';

const tenantId = parseInt(process.argv[2] || '20', 10);
const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function main() {
  const termId = 62; // active TERM 3 2028
  const queries = {
    feeStructures: `SELECT id, class_id, term_id, total FROM ledger_fee_structures WHERE tenant_id=$1 ORDER BY term_id, id`,
    ledgerByTerm: `SELECT term_id, entry_type, COUNT(*)::int c, SUM(debit)::numeric deb, SUM(credit)::numeric cred
      FROM student_ledger WHERE tenant_id=$1 GROUP BY term_id, entry_type ORDER BY term_id, entry_type`,
    ledgerTerm62: `SELECT id, student_id, entry_type, debit, credit, description FROM student_ledger WHERE tenant_id=$1 AND term_id=$2 LIMIT 20`,
    payments: `SELECT term_id, COUNT(*)::int c, SUM(amount)::numeric total FROM payments WHERE tenant_id=$1 AND COALESCE(is_voided,false)=false GROUP BY term_id`,
    arrears: `SELECT COUNT(*)::int c, SUM(amount)::numeric total FROM term_arrears WHERE tenant_id=$1`,
    outstanding: `SELECT term_id, COUNT(*)::int c, SUM(outstanding_balance)::numeric total FROM term_outstanding_balances WHERE tenant_id=$1 GROUP BY term_id`,
    closing: `SELECT term_id, COUNT(*)::int c, SUM(carried_balance)::numeric total FROM term_closing_balances WHERE tenant_id=$1 GROUP BY term_id`,
    classes: `SELECT id, class_name, name, fee_mode FROM classes WHERE tenant_id=$1`,
    students: `SELECT id, first_name, last_name, class_assigned_id, enrollment_status FROM students WHERE tenant_id=$1 LIMIT 10`,
  };
  for (const [label, sql] of Object.entries(queries)) {
    const r = await pool.query(sql, label.includes('Term62') || label === 'ledgerTerm62' ? [tenantId, termId] : [tenantId]);
    console.log(`\n=== ${label} ===`, JSON.stringify(r.rows, null, 2));
  }
}

main().finally(() => pool.end());
