import 'dotenv/config';
import pg from 'pg';

const tenantId = parseInt(process.argv[2] || '20', 10);
const ledgerTermId = parseInt(process.argv[3] || '61', 10);
const actorUserId = parseInt(process.argv[4] || '1', 10);

const pool = new pg.Pool({
  host: process.env.PG_HOST,
  port: process.env.PG_PORT ? parseInt(process.env.PG_PORT, 10) : 5432,
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DATABASE,
});

async function main() {
  const client = await pool.connect();
  try {
    const termRes = await client.query(
      `SELECT t.id, t.name, t.status, t.is_current, ay.name AS academic_year
       FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.id = $1 AND t.tenant_id = $2`,
      [ledgerTermId, tenantId]
    );
    if (!termRes.rows.length) throw new Error('Ledger term not found');
    const term = termRes.rows[0];
    console.log('Closing:', term);

    const activeAcademic = await client.query(
      `SELECT id, term_name, year, ledger_term_id FROM academic_terms
       WHERE tenant_id = $1 AND is_active = true LIMIT 1`,
      [tenantId]
    );
    const active = activeAcademic.rows[0];
    if (active && Number(active.ledger_term_id) === ledgerTermId) {
      console.log('Active academic term linked to ff — re-pointing first:', active);
      const settings = await client.query(
        'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
        [tenantId]
      );
      const currentTerm = String(settings.rows[0]?.current_term || active.term_name || '').trim();
      const currentYear = String(settings.rows[0]?.current_year || active.year || '').trim();
      const termOnly = currentTerm.replace(/\s+\d{4}(\s*\/\s*\d{4})?$/, '').trim() || currentTerm;

      let yearRow = await client.query(
        `SELECT id FROM academic_years WHERE tenant_id = $1 AND TRIM(name) = TRIM($2) LIMIT 1`,
        [tenantId, currentYear]
      );
      if (!yearRow.rows.length) {
        yearRow = await client.query(
          `INSERT INTO academic_years (tenant_id, name, is_current) VALUES ($1, $2, true) RETURNING id`,
          [tenantId, currentYear]
        );
      }
      const academicYearId = Number(yearRow.rows[0].id);

      let newLedger = await client.query(
        `SELECT id FROM terms
         WHERE tenant_id = $1 AND academic_year_id = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
         LIMIT 1`,
        [tenantId, academicYearId, termOnly]
      );
      if (!newLedger.rows.length) {
        newLedger = await client.query(
          `INSERT INTO terms (tenant_id, academic_year_id, name, is_current, status)
           VALUES ($1, $2, $3, true, 'active') RETURNING id`,
          [tenantId, academicYearId, termOnly]
        );
      }
      const newLedgerId = Number(newLedger.rows[0].id);
      await client.query('UPDATE terms SET is_current = false WHERE tenant_id = $1', [tenantId]);
      await client.query(
        `UPDATE terms SET is_current = true, status = 'active' WHERE id = $1 AND tenant_id = $2`,
        [newLedgerId, tenantId]
      );
      await client.query(
        `UPDATE academic_terms SET ledger_term_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND tenant_id = $3`,
        [newLedgerId, active.id, tenantId]
      );
      console.log('Re-pointed active academic term to ledger', newLedgerId);
    }

    await client.query('BEGIN');

    await client.query(
      `UPDATE terms
       SET status = 'closed', is_current = false,
           closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
           closed_by_user_id = $3,
           snapshot_completed_at = COALESCE(snapshot_completed_at, CURRENT_TIMESTAMP)
       WHERE id = $1 AND tenant_id = $2`,
      [ledgerTermId, tenantId, actorUserId]
    );

    await client.query(
      `UPDATE academic_terms
       SET is_active = false,
           closed_at = COALESCE(closed_at, CURRENT_TIMESTAMP),
           ledger_term_id = CASE WHEN ledger_term_id = $2 THEN NULL ELSE ledger_term_id END,
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $1 AND ledger_term_id = $2`,
      [tenantId, ledgerTermId]
    );

    await client.query(
      `UPDATE academic_terms at
       SET is_active = false,
           closed_at = COALESCE(at.closed_at, CURRENT_TIMESTAMP),
           ledger_term_id = COALESCE(at.ledger_term_id, $2),
           updated_at = CURRENT_TIMESTAMP
       FROM terms t
       JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE at.tenant_id = $1 AND t.id = $2
         AND LOWER(TRIM(at.term_name)) = LOWER(TRIM(t.name))
         AND (
           TRIM(REPLACE(COALESCE(at.year, ''), ' ', '')) = TRIM(REPLACE(ay.name, ' ', ''))
           OR TRIM(ay.name) LIKE '%' || TRIM(at.year) || '%'
         )`,
      [tenantId, ledgerTermId]
    );

    await client.query('COMMIT');
    console.log('Force-closed ledger term', ledgerTermId);

    const verify = await client.query(
      `SELECT t.id, t.name, t.status, t.is_current, t.closed_at, ay.name AS academic_year
       FROM terms t JOIN academic_years ay ON ay.id = t.academic_year_id
       WHERE t.tenant_id = $1 ORDER BY t.id DESC`,
      [tenantId]
    );
    console.log('LEDGER AFTER:', verify.rows);

    const academic = await client.query(
      `SELECT id, term_name, year, is_active, closed_at, ledger_term_id FROM academic_terms
       WHERE tenant_id = $1 ORDER BY id DESC LIMIT 8`,
      [tenantId]
    );
    console.log('ACADEMIC AFTER:', academic.rows);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
