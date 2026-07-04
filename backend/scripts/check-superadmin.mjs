import 'dotenv/config';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const r = await pool.query(`
  SELECT id, username, email, role, tenant_id, is_active
  FROM users
  WHERE LOWER(TRIM(role)) IN ('super-admin', 'superadmin')
`);
console.log(JSON.stringify(r.rows, null, 2));
await pool.end();
