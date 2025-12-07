import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listEvents(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.events.list);
}

export async function createEvent(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.events.create, payload);
}

export default { listEvents, createEvent };
