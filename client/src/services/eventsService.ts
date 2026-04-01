import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listEvents(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.events.list);
}

export async function createEvent(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.events.create, payload);
}

export async function getEvent(id: string | number): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.events.get(id.toString()) as any);
}

export async function updateEvent(id: string | number, payload: any): Promise<{ data: any }> {
  return apiService.put(ENDPOINTS.events.update(id.toString()) as any, payload);
}

export async function deleteEvent(id: string | number): Promise<{ data: any }> {
  return apiService.delete(ENDPOINTS.events.delete(id.toString()) as any);
}

export default { listEvents, createEvent };
