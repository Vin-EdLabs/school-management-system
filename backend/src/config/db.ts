import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

// Support using a single DATABASE_URL or individual PG_* vars.
// When connecting to hosted Postgres (e.g., Supabase) we usually need SSL.
// You can control SSL with `PGSSLMODE=disable` or `PG_SSL=false` in .env to opt out.
const useSslEnv = ((): boolean => {
  const mode = (process.env.PGSSLMODE || '').toLowerCase();
  if (mode) return mode !== 'disable' && mode !== '0' && mode !== 'false';
  const v = (process.env.PG_SSL || '').toLowerCase();
  if (v) return v !== '0' && v !== 'false';
  // Default to true when DATABASE_URL looks like a remote host (not localhost)
  return true;
})();

const sslOption = useSslEnv ? { rejectUnauthorized: false } : false;

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: sslOption })
  : new Pool({
      host: process.env.PG_HOST ?? 'localhost',
      port: Number(process.env.PG_PORT ?? 5432),
      user: process.env.PG_USER ?? 'postgres',
      password: process.env.PG_PASSWORD ?? 'postgres',
      database: process.env.PG_DATABASE ?? 'school_db',
      ssl: sslOption,
    });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.debug('DB QUERY', { text, duration, rows: res.rowCount });
  return res;
}

export default pool;
