import 'dotenv/config';
import pg from 'pg';

const tenantId = 20;
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

const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query(
    `UPDATE academic_terms
     SET ledger_term_id = 65, updated_at = CURRENT_TIMESTAMP
     WHERE id = 48 AND tenant_id = $1`,
    [tenantId]
  );
  await client.query(`UPDATE terms SET is_current = false WHERE tenant_id = $1`, [tenantId]);
  await client.query(
    `UPDATE terms
     SET status = 'closed', is_current = false
     WHERE tenant_id = $1 AND closed_at IS NOT NULL`,
    [tenantId]
  );
  await client.query(
    `UPDATE terms
     SET is_current = true, status = 'active', closed_at = NULL
     WHERE id = 65 AND tenant_id = $1`,
    [tenantId]
  );
  await client.query(
    `UPDATE school_settings
     SET current_term = 'Term 2 2028/2029', current_year = '2028/2029', updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $1`,
    [tenantId]
  );
  await client.query('COMMIT');

  const check = await pool.query(
    `SELECT at.id, at.term_name, at.year, at.ledger_term_id,
            t.id AS current_ledger_id, t.name AS current_ledger_name, t.is_current, t.status
     FROM academic_terms at
     LEFT JOIN terms t ON t.tenant_id = at.tenant_id AND t.is_current = true
     WHERE at.tenant_id = $1 AND at.is_active = true`,
    [tenantId]
  );
  console.log('AFTER REPAIR:', JSON.stringify(check.rows, null, 2));
} catch (err) {
  await client.query('ROLLBACK');
  throw err;
} finally {
  client.release();
  await pool.end();
}
