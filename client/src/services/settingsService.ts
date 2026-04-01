import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function getSettings(): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.settings.list);
}

export async function updateSetting(key: string, payload: any) {
  return apiService.put(ENDPOINTS.settings.update(key), payload);
}

export async function getActiveTerm(): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.settings.list}/active-term`);
}

export async function setActiveTerm(id: number | string) {
  return apiService.put(ENDPOINTS.settings.activeTerm(id), {});
}

export async function getActiveYear(): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.settings.list}/active-year`);
}

export async function setActiveYear(payload: any) {
  return apiService.put(`${ENDPOINTS.settings.list}/active-year`, payload);
}

export async function listTerms(): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.settings.terms);
}

export async function createTerm(payload: any) {
  return apiService.post(ENDPOINTS.settings.terms, payload);
}

export async function updateTerm(id: number | string, payload: any) {
  return apiService.put(ENDPOINTS.settings.term(id), payload);
}

export async function deleteTerm(id: number | string) {
  return apiService.delete(ENDPOINTS.settings.term(id));
}

export default {
  getSettings,
  updateSetting,
  getActiveTerm,
  setActiveTerm,
  getActiveYear,
  setActiveYear,
  listTerms,
  createTerm,
  updateTerm,
  deleteTerm
};
