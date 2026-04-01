import pool from '../config/db.js';

const check = async (): Promise<boolean> => {
  try {
    const res = await pool.query('SELECT 1 as ok');
    console.log('DB connected:', res.rows[0]);
    return true;
  } catch (err: any) {
    console.error('DB connection failed:', err.message ?? err);
    return false;
  }
}

export default check;

// If run directly (e.g. `npm run check-db`), exit with appropriate code
const invokedDirectly = typeof process !== 'undefined' && (process.argv[1]?.endsWith('check-db.ts') || process.argv[1]?.endsWith('check-db.js'));
if (invokedDirectly) {
  check().then(ok => process.exit(ok ? 0 : 2));
}
