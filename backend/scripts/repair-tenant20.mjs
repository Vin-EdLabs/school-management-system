import pg from 'pg';
import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../.env') });

const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: parseInt(process.env.PG_PORT || '5432', 10),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

const TENANT = 20;

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetYear = '2026/2027';
    const targetTermName = 'TERM 1';

    let ay = await client.query(
      'SELECT id FROM academic_years WHERE tenant_id = $1 AND name = $2 LIMIT 1',
      [TENANT, targetYear]
    );
    const ayId = ay.rows[0]?.id;
    if (!ayId) throw new Error('Academic year 2026/2027 not found');

    await client.query('UPDATE academic_years SET is_current = false WHERE tenant_id = $1', [TENANT]);
    await client.query('UPDATE academic_years SET is_current = true WHERE id = $1', [ayId]);

    let canonical = await client.query(
      `SELECT id FROM terms WHERE tenant_id = $1 AND academic_year_id = $2 AND name = $3 LIMIT 1`,
      [TENANT, ayId, targetTermName]
    );

    let canonicalId = canonical.rows[0]?.id;
    if (!canonicalId) {
      const ins = await client.query(
        `INSERT INTO terms (tenant_id, academic_year_id, name, is_current) VALUES ($1, $2, $3, true) RETURNING id`,
        [TENANT, ayId, targetTermName]
      );
      canonicalId = ins.rows[0].id;
    }

    const dataTerms = await client.query(
      `SELECT DISTINCT t.id
       FROM terms t
       WHERE t.tenant_id = $1 AND t.id != $2
         AND (
           EXISTS (SELECT 1 FROM student_ledger sl WHERE sl.term_id = t.id AND sl.tenant_id = t.tenant_id)
           OR EXISTS (SELECT 1 FROM ledger_fee_structures lfs WHERE lfs.term_id = t.id AND lfs.tenant_id = t.tenant_id)
         )`,
      [TENANT, canonicalId]
    );

    for (const row of dataTerms.rows) {
      const fromId = row.id;
      await client.query(
        `UPDATE student_ledger SET term_id = $1, academic_year_id = $2 WHERE tenant_id = $3 AND term_id = $4`,
        [canonicalId, ayId, TENANT, fromId]
      );
      await client.query(
        `UPDATE ledger_fee_structures SET term_id = $1, academic_year_id = $2 WHERE tenant_id = $3 AND term_id = $4`,
        [canonicalId, ayId, TENANT, fromId]
      );
      await client.query(
        `UPDATE payments SET term_id = $1 WHERE tenant_id = $2 AND term_id = $3`,
        [canonicalId, TENANT, fromId]
      );
      await client.query(
        `UPDATE invoices SET term_id = $1 WHERE tenant_id = $2 AND term_id = $3`,
        [canonicalId, TENANT, fromId]
      ).catch(() => undefined);
      await client.query(`DELETE FROM terms WHERE id = $1 AND tenant_id = $2`, [fromId, TENANT]);
      console.log('Merged term', fromId, '→', canonicalId);
    }

    await client.query(`UPDATE terms SET is_current = false WHERE tenant_id = $1`, [TENANT]);
    await client.query(`UPDATE terms SET is_current = true WHERE id = $1`, [canonicalId]);

    await client.query(
      `UPDATE school_settings SET current_term = $1, current_year = $2 WHERE tenant_id = $3`,
      [targetTermName, targetYear, TENANT]
    );

    await client.query('COMMIT');
    console.log('Tenant 20 merged to canonical term', canonicalId, 'year', ayId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
