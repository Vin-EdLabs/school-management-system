
import pool from '../config/db.js';

const check = async () => {
    try {
        const res = await pool.query('SELECT count(*) FROM income');
        console.log('INCOME COUNT:', res.rows[0].count);

        const sample = await pool.query('SELECT * FROM income LIMIT 5');
        console.log('SAMPLE DATA:', JSON.stringify(sample.rows, null, 2));

        return true;
    } catch (err: any) {
        console.error('DB check failed:', err.message ?? err);
        return false;
    }
}

check().then(() => process.exit(0));
