import 'dotenv/config';
import pg from 'pg';

const tenantId = parseInt(process.argv[2] || '20', 10);
const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : {
        host: process.env.PG_HOST,
        port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
        user: process.env.PG_USER,
        password: process.env.PG_PASSWORD,
        database: process.env.PG_DATABASE,
      }
);

const q = async (sql, p) => (await pool.query(sql, p)).rows;

try {
  const school = await q('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
  console.log('TENANT:', JSON.stringify(school[0] || null));

  const ledger = await q(
    `SELECT t.id, t.name, t.status, t.is_current, t.closed_at, ay.name AS academic_year,
            at.id AS academic_term_id, at.term_name, at.is_active AS academic_is_active,
            at.closed_at AS academic_closed_at, at.ledger_term_id
     FROM terms t
     JOIN academic_years ay ON ay.id = t.academic_year_id
     LEFT JOIN academic_terms at ON at.tenant_id = t.tenant_id AND at.ledger_term_id = t.id
     WHERE t.tenant_id = $1
     ORDER BY ay.name DESC, t.id DESC`,
    [tenantId]
  );
  console.log('LEDGER TERMS:', JSON.stringify(ledger, null, 2));

  const academic = await q(
    `SELECT id, term_name, year, is_active, closed_at, ledger_term_id, is_archived
     FROM academic_terms WHERE tenant_id = $1 ORDER BY year DESC, id DESC`,
    [tenantId]
  );
  console.log('ACADEMIC TERMS:', JSON.stringify(academic, null, 2));

  const settings = await q('SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1', [
    tenantId,
  ]);
  console.log('SETTINGS:', JSON.stringify(settings[0] || null));
} finally {
  await pool.end();
}
