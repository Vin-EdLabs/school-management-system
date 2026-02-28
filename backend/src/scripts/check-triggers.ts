
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'school_db',
});

async function check() {
    try {
        const res = await pool.query(`
      SELECT 
        tgname AS trigger_name,
        relname AS table_name,
        proname AS function_name,
        prosrc AS function_source
      FROM pg_trigger
      JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid
      JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
      WHERE tgname NOT LIKE 'pg_%'
    `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

check();
