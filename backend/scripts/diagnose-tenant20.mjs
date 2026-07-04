import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const TENANT_ID = 20;

async function q(label, sql, params = []) {
  const r = await pool.query(sql, params);
  console.log(`\n=== ${label} ===`);
  console.table(r.rows);
  return r.rows;
}

async function main() {
  await q('Tenant', 'SELECT id, name, slug FROM tenants WHERE id = $1', [TENANT_ID]);

  await q('School settings', 'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1', [TENANT_ID]);

  await q('Academic terms', `SELECT id, term_name, year, is_active, is_archived FROM academic_terms WHERE tenant_id = $1 ORDER BY id`, [TENANT_ID]);

  await q('Academic years', `SELECT id, name, is_current FROM academic_years WHERE tenant_id = $1 ORDER BY id`, [TENANT_ID]);

  await q('Ledger terms', `SELECT t.id, t.name, t.academic_year_id, ay.name AS year_name, t.is_current,
    (SELECT COUNT(*) FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id) AS ledger_rows,
    (SELECT COUNT(*) FROM ledger_fee_structures lfs WHERE lfs.term_id = t.id AND lfs.tenant_id = t.tenant_id) AS fee_structures,
    (SELECT COALESCE(SUM(debit),0) FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id) AS total_debit
    FROM terms t
    LEFT JOIN academic_years ay ON ay.id = t.academic_year_id
    WHERE t.tenant_id = $1 ORDER BY t.id`, [TENANT_ID]);

  const settings = await pool.query('SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1', [TENANT_ID]);
  const { current_term, current_year } = settings.rows[0] || {};

  // Simulate old vs new resolution
  const termLabel = String(current_term || '').trim();
  const termOnly = termLabel.replace(/\s+\d{4}(\/\d{4})?$/, '').trim() || termLabel;
  const likeTerm = `%${termOnly}%`;

  await q('OLD resolution (is_current + ILIKE)', `
    SELECT t.id, t.name, t.is_current,
      (SELECT COUNT(*) FROM student_ledger sl WHERE sl.term_id = t.id) AS ledger_rows
    FROM terms t
    JOIN academic_terms at ON at.tenant_id = t.tenant_id
    WHERE t.tenant_id = $1 AND at.is_active = true
      AND t.name ILIKE '%' || at.term_name || '%'
      AND t.is_current = true
    LIMIT 5`, [TENANT_ID]);

  await q('NEW P1 (is_current + data)', `
    SELECT t.id, t.name, t.is_current,
      (SELECT COUNT(*) FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id) AS ledger_rows
    FROM terms t
    WHERE t.tenant_id = $1 AND t.is_current = true
      AND (t.name = $2 OR t.name = $3 OR t.name ILIKE $4)
      AND (
        EXISTS (SELECT 1 FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id)
        OR EXISTS (SELECT 1 FROM ledger_fee_structures lfs WHERE lfs.term_id = t.id AND lfs.tenant_id = t.tenant_id)
      )
    LIMIT 1`, [TENANT_ID, termLabel, termOnly, likeTerm]);

  await q('NEW P2 (any term with data)', `
    SELECT t.id, t.name, t.is_current,
      (SELECT COUNT(*) FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id) AS ledger_rows,
      (SELECT COALESCE(SUM(debit),0) FROM student_ledger sl WHERE sl.term_id = t.id) AS total_debit
    FROM terms t
    WHERE t.tenant_id = $1
      AND (t.name = $2 OR t.name = $3 OR t.name ILIKE $4)
      AND EXISTS (SELECT 1 FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id)
    ORDER BY t.id DESC LIMIT 3`, [TENANT_ID, termLabel, termOnly, likeTerm]);

  await q('Student ledger summary by term', `
    SELECT sl.term_id, t.name AS term_name, COUNT(DISTINCT sl.student_id) AS students,
      COALESCE(SUM(sl.debit),0) AS total_debit, COALESCE(SUM(sl.credit),0) AS total_credit
    FROM student_ledger sl
    JOIN terms t ON t.id = sl.term_id
    WHERE sl.tenant_id = $1
    GROUP BY sl.term_id, t.name ORDER BY sl.term_id`, [TENANT_ID]);

  await q('Fee structures by term', `
    SELECT lfs.term_id, t.name, COUNT(*) AS classes, SUM(lfs.total) AS total_fees
    FROM ledger_fee_structures lfs
    JOIN terms t ON t.id = lfs.term_id
    WHERE lfs.tenant_id = $1
    GROUP BY lfs.term_id, t.name ORDER BY lfs.term_id`, [TENANT_ID]);

  await q('Active students count', `
    SELECT COUNT(*) AS active_students FROM students
    WHERE tenant_id = $1 AND COALESCE(enrollment_status,'active') = 'active'`, [TENANT_ID]);

  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
