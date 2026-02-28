import * as repo from '../repositories/settings.repository.js';

export async function getActiveTerm() {
  const terms = await repo.listTerms();
  return terms.find((t: any) => t.is_active) || null;
}

export async function setActiveTerm(id: number) {
  return repo.setActiveTerm(id);
}

export async function getActiveYear() {
  return repo.getSetting('active_year');
}

export async function setActiveYear(year: any) {
  return repo.setSetting('active_year', year);
}

export async function listTerms() {
  return repo.listTerms();
}

export async function createTerm(payload: any) {
  return repo.createTerm(payload);
}

export async function updateTerm(id: number, payload: any) {
  return repo.updateTerm(id, payload);
}

export async function deleteTerm(id: number) {
  return repo.deleteTerm(id);
}

export async function getAllSettings() {
  await repo.ensureSettingsTable();
  const res = await repo.query('SELECT key, value FROM settings');
  const settings: Record<string, any> = {};
  res.rows.forEach((row: any) => {
    settings[row.key] = row.value;
  });
  return settings;
}
