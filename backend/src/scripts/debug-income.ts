
import pool from '../config/db.js';

async function dump() {
    try {
        const res = await pool.query('SELECT * FROM income LIMIT 10');
        console.log('INCOME DATA:', JSON.stringify(res.rows, null, 2));

        const schema = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'income'
    `);
        console.log('INCOME SCHEMA:', JSON.stringify(schema.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

dump();
