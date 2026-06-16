import { Client } from 'pg';

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'school_app_user',
  password: 'vin-edi',
  database: 'school_db',
});

async function main() {
  try {
    await client.connect();
    const res = await client.query('SELECT id, name, slug, subdomain FROM tenants');
    console.log('--- TENANTS IN DATABASE ---');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Database connection error:', err);
  } finally {
    await client.end();
  }
}

main();
