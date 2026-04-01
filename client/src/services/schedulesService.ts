import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listByTeacher(id: string | number) {
  return apiService.get(ENDPOINTS.schedulesByTeacher ? (ENDPOINTS.schedulesByTeacher(id.toString())) : `/schedules/teacher/${id}` as any);
}

export async function listByClass(id: string | number) {
  return apiService.get(ENDPOINTS.schedulesByClass ? (ENDPOINTS.schedulesByClass(id.toString())) : `/schedules/class/${id}` as any);
}

export async function listAll() {
  return apiService.get('/schedules');
}

export async function createSchedule(payload: any) {
  return apiService.post('/schedules', payload);
}

export async function updateSchedule(id: string | number, payload: any) {
  return apiService.put(`/schedules/${id}`, payload);
}

export async function deleteSchedule(id: string | number) {
  return apiService.delete(`/schedules/${id}`);
}

export default { listByTeacher, listByClass, listAll, createSchedule, updateSchedule, deleteSchedule };
