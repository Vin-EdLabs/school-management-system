import { query } from '../config/db.js';

// simple key/value settings table could be used; for now store active term/year in a settings table
export async function ensureSettingsTable() {
  await query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)`);
}

export async function getSetting(key: string) {
  const res = await query('SELECT value FROM settings WHERE key = $1 LIMIT 1', [key]);
  return res.rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: any) {
  await ensureSettingsTable();
  await query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, JSON.stringify(value)]);
  return getSetting(key);
}
