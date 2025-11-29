import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function getActiveTerm() {
  return apiService.get(`${ENDPOINTS.settings}/active-term`);
}

export async function setActiveTerm(payload: any) {
  return apiService.put(`${ENDPOINTS.settings}/active-term`, payload);
}

export async function getActiveYear() {
  return apiService.get(`${ENDPOINTS.settings}/active-year`);
}

export async function setActiveYear(payload: any) {
  return apiService.put(`${ENDPOINTS.settings}/active-year`, payload);
}

export default { getActiveTerm, setActiveTerm, getActiveYear, setActiveYear };
