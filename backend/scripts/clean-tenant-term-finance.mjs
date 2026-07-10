import 'dotenv/config';
import pg from 'pg';

const tenantId = 20;
const staleTermId = 61;

const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const client = await pool.connect();
try {
  await client.query('BEGIN');

  const fs = await client.query(
    `SELECT id FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
    [tenantId, staleTermId]
  );
  const fsIds = fs.rows.map((r) => Number(r.id));
  if (fsIds.length) {
    await client.query(
      `DELETE FROM fee_structure_items WHERE tenant_id = $1 AND fee_structure_id = ANY($2::int[])`,
      [tenantId, fsIds]
    );
    await client.query(
      `DELETE FROM ledger_fee_structures WHERE tenant_id = $1 AND term_id = $2`,
      [tenantId, staleTermId]
    );
  }

  await client.query(`DELETE FROM student_ledger WHERE tenant_id = $1 AND term_id = $2`, [tenantId, staleTermId]);
  await client.query(`DELETE FROM payments WHERE tenant_id = $1 AND term_id = $2`, [tenantId, staleTermId]);
  await client.query(`DELETE FROM term_outstanding_balances WHERE tenant_id = $1 AND term_id = $2`, [tenantId, staleTermId]);
  await client.query(`DELETE FROM term_closing_balances WHERE tenant_id = $1 AND term_id = $2`, [tenantId, staleTermId]);
  await client.query(`DELETE FROM student_charges WHERE tenant_id = $1 AND term_id = $2`, [tenantId, staleTermId]);

  await client.query('COMMIT');
  console.log('Cleaned stale finance data for tenant', tenantId, 'term', staleTermId);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
  await pool.end();
}
