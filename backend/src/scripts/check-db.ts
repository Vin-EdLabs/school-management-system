import pool from '../config/db.js';

const check = async () => {
  try {
    const res = await pool.query('SELECT 1 as ok');
    console.log('DB connected:', res.rows[0]);
    process.exit(0);
  } catch (err: any) {
    console.error('DB connection failed:', err.message ?? err);
    process.exit(2);
  }
}

export default check;
