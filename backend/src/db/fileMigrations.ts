import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from './connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveMigrationsDir(): string | null {
  const candidates = [
    path.join(__dirname, '../../db/migrations'),
    path.join(__dirname, '../../../db/migrations'),
    path.join(process.cwd(), 'db/migrations'),
    path.join(process.cwd(), 'backend/db/migrations'),
    path.join(process.cwd(), 'dist/db/migrations'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) {
      return dir;
    }
  }
  return null;
}

/** Apply pending SQL files from backend/db/migrations (safe to call on every server start). */
export async function applyPendingSqlFileMigrations(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = resolveMigrationsDir();
  if (!migrationsDir) {
    console.warn('⚠️ No db/migrations directory found — relying on inline ensureSchema only');
    return;
  }

  console.log(`📂 SQL migrations directory: ${migrationsDir}`);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const applied = await query('SELECT 1 FROM schema_migrations WHERE filename = $1', [file]);
    if (applied.rows.length > 0) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Applying SQL migration: ${file}`);
    try {
      await query(sql);
      await query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
      console.log(`✅ Applied SQL migration: ${file}`);
    } catch (err: any) {
      console.error(`❌ SQL migration failed (${file}):`, err?.message || err);
      // Do not throw — ensureSupplementalSchema already applied critical DDL
    }
  }
}
