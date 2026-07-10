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

const q = (sql, p) => pool.query(sql, p);

async function main() {
  const years = await q(
    'SELECT id, name, is_current, status FROM academic_years WHERE tenant_id = $1 ORDER BY id',
    [tenantId]
  );
  console.log('YEARS', years.rows);

  const fees = await q(
    'SELECT id, class_id, term_id, total FROM ledger_fee_structures WHERE tenant_id = $1 ORDER BY term_id, class_id',
    [tenantId]
  );
  console.log('FEES', fees.rows);

  const ff = await q(
    `SELECT t.*, ay.name AS year_name
     FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id
     WHERE t.tenant_id = $1 AND LOWER(TRIM(t.name)) = 'ff'`,
    [tenantId]
  );
  console.log('FF TERM', ff.rows);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => pool.end());
