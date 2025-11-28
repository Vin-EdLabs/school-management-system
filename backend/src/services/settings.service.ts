import * as repo from '../repositories/settings.repository.js';

export async function getActiveTerm() {
  return repo.getSetting('active_term');
}

export async function setActiveTerm(term: any) {
  return repo.setSetting('active_term', term);
}

export async function getActiveYear() {
  return repo.getSetting('active_year');
}

export async function setActiveYear(year: any) {
  return repo.setSetting('active_year', year);
}
