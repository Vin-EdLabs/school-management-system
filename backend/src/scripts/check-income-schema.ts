
import pool from '../config/db.js';

const checkSchema = async () => {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'income'
    `);
        console.log('COLUMNS:', res.rows.map(r => r.column_name).join(', '));
    } catch (err: any) {
        console.error('Schema check failed:', err.message);
    } finally {
        process.exit(0);
    }
}

checkSchema();
