import { query as dbQuery } from '../config/db.js';

export const query = dbQuery;

// simple key/value settings table could be used; for now store active term/year in a settings table
export async function ensureSettingsTable() {
  await query(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB)`);
}

export async function ensureYearsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS academic_years (
      id SERIAL PRIMARY KEY,
      year_label TEXT NOT NULL UNIQUE,
      start_date DATE,
      end_date DATE,
      is_active BOOLEAN DEFAULT false
    )
  `);
}

export async function ensureTermsTable() {
  await ensureYearsTable();
  await query(`
    CREATE TABLE IF NOT EXISTS academic_terms (
      id SERIAL PRIMARY KEY,
      academic_year_id INTEGER REFERENCES academic_years(id),
      name TEXT NOT NULL,
      start_date DATE,
      end_date DATE,
      is_active BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, academic_year_id)
    )
  `);
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

export async function listTerms() {
  await ensureTermsTable();
  const res = await query(`
    SELECT t.*, y.year_label as year 
    FROM academic_terms t 
    JOIN academic_years y ON t.academic_year_id = y.id 
    ORDER BY y.year_label DESC, t.start_date DESC
  `);
  return res.rows;
}

async function getOrCreateYearId(yearLabel: string) {
  await ensureYearsTable();
  const res = await query('SELECT id FROM academic_years WHERE year_label = $1', [yearLabel]);
  if (res.rows.length > 0) return res.rows[0].id;

  const insert = await query('INSERT INTO academic_years (year_label) VALUES ($1) RETURNING id', [yearLabel]);
  return insert.rows[0].id;
}

export async function createTerm(payload: any) {
  await ensureTermsTable();
  const { name, year, startDate, endDate, isActive } = payload;
  const yearId = await getOrCreateYearId(year);

  if (isActive) {
    await query('UPDATE academic_terms SET is_active = false');
  }

  const res = await query(
    'INSERT INTO academic_terms (name, academic_year_id, start_date, end_date, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name, yearId, startDate || null, endDate || null, !!isActive]
  );
  return res.rows[0];
}

export async function updateTerm(id: number, payload: any) {
  const { name, year, startDate, endDate, isActive } = payload;
  let yearId = null;
  if (year) {
    yearId = await getOrCreateYearId(year);
  }

  if (isActive) {
    await query('UPDATE academic_terms SET is_active = false');
  }

  const res = await query(
    `UPDATE academic_terms 
     SET name = COALESCE($1, name), 
         academic_year_id = COALESCE($2, academic_year_id), 
         start_date = $3, 
         end_date = $4, 
         is_active = $5 
     WHERE id = $6 RETURNING *`,
    [name, yearId, startDate || null, endDate || null, !!isActive, id]
  );
  return res.rows[0];
}

export async function deleteTerm(id: number) {
  await query('DELETE FROM academic_terms WHERE id = $1', [id]);
  return true;
}

export async function setActiveTerm(id: number) {
  await query('UPDATE academic_terms SET is_active = false');
  const res = await query('UPDATE academic_terms SET is_active = true WHERE id = $1 RETURNING *', [id]);
  return res.rows[0];
}
