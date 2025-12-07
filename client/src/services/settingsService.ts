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

export async function setActiveTerm(payload: any) {
  return apiService.put(`${ENDPOINTS.settings.list}/active-term`, payload);
}

export async function getActiveYear(): Promise<{ data: any }> {
  return apiService.get(`${ENDPOINTS.settings.list}/active-year`);
}

export async function setActiveYear(payload: any) {
  return apiService.put(`${ENDPOINTS.settings.list}/active-year`, payload);
}

export default { getSettings, updateSetting, getActiveTerm, setActiveTerm, getActiveYear, setActiveYear };
