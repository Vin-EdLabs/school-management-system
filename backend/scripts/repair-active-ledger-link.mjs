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

const { repairActiveAcademicTermLedgerLink } = await import(
  '../dist/services/academicTermLedgerSyncService.js'
).catch(() => import('../src/services/academicTermLedgerSyncService.ts'));

try {
  const result = await repairActiveAcademicTermLedgerLink(tenantId);
  console.log('REPAIR RESULT:', JSON.stringify(result, null, 2));
  const settings = await pool.query(
    'SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1',
    [tenantId]
  );
  const academic = await pool.query(
    `SELECT id, term_name, year, is_active, ledger_term_id FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  const ledger = await pool.query(
    `SELECT id, name, is_current, status, closed_at FROM terms
     WHERE tenant_id = $1 AND (is_current = true OR id = ANY($2::int[]))
     ORDER BY id`,
    [tenantId, [result.activeLedgerTermId, result.previousLedgerTermId].filter(Boolean)]
  );
  console.log('SETTINGS:', settings.rows[0]);
  console.log('ACTIVE ACADEMIC:', academic.rows[0]);
  console.log('LEDGER:', ledger.rows);
} finally {
  await pool.end();
}
