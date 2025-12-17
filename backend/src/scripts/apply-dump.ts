import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const sqlPath = path.join(__dirname, '../../sql/init-seed.sql');

  console.log('Reading SQL file:', sqlPath);
  const raw = await fs.readFile(sqlPath, 'utf8');

  const lines = raw.split(/\r?\n/);

  // Collect only INSERT and sequence setval statements (these are what the dump contains)
  const stmts: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('--')) continue;
    // We want full INSERT lines and the setval SELECTs
    if (trimmed.startsWith('INSERT INTO') || trimmed.startsWith('SELECT pg_catalog.setval')) {
      stmts.push(trimmed);
    }
  }

  if (stmts.length === 0) {
    console.log('No INSERT/SETVAL statements found in SQL file. Nothing to run.');
    return;
  }

  // Execute in batches to avoid huge single query
  const batchSize = 250; // safe default
  for (let i = 0; i < stmts.length; i += batchSize) {
    const batch = stmts.slice(i, i + batchSize);
    const sql = ['BEGIN;', ...batch, 'COMMIT;'].join('\n');
    console.log(`Running batch ${Math.floor(i / batchSize) + 1} (${batch.length} statements)`);
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('Error executing batch:', err);
      try {
        await pool.query('ROLLBACK;');
      } catch (er) {
        // ignore
      }
      process.exit(1);
    }
  }

  console.log('All INSERT/SETVAL statements executed successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
