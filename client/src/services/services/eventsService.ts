import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listEvents() {
  return apiService.get(ENDPOINTS.events);
}

export async function createEvent(payload: any) {
  return apiService.post(ENDPOINTS.events, payload);
}

export async function getEvent(id: string) {
  return apiService.get(`${ENDPOINTS.events}/${id}`);
}

export async function updateEvent(id: string, payload: any) {
  return apiService.put(`${ENDPOINTS.events}/${id}`, payload);
}

export async function deleteEvent(id: string) {
  return apiService.delete(`${ENDPOINTS.events}/${id}`);
}
