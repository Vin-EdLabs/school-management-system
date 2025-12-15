import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/db.js';

const applySchema = async (): Promise<void> => {
  const file = path.join(process.cwd(), 'sql', 'init-schema.sql');
  if (!fs.existsSync(file)) throw new Error(`Schema file not found: ${file}`);
  const sql = fs.readFileSync(file, 'utf8');

  try {
    console.log('Applying SQL schema from', file);
    // Run whole file as a single query; Postgres accepts multiple statements
    await pool.query(sql);
    console.log('Schema applied successfully');
  } catch (e) {
    console.error('Failed to apply schema from file:', e);
    throw e;
  }
};

export default applySchema;

// If invoked directly from CLI (ESM-safe)
const invokedDirectly = (() => {
  try {
    const scriptPath = fileURLToPath(import.meta.url);
    const resolved = path.resolve(scriptPath);
    const arg1 = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return arg1 === resolved || arg1.endsWith('apply-schema.ts') || arg1.endsWith('apply-schema.js');
  } catch (e) {
    return false;
  }
})();

if (invokedDirectly) {
  applySchema().then(() => process.exit(0)).catch(() => process.exit(2));
}
