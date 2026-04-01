import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listStaff(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.staff.list);
}

export async function createStaff(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.staff.create, payload);
}

export async function getStaff(id: string): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.staff.get(id));
}
export async function getNextStaffId(): Promise<{ data: { nextId: string } }> {
  return apiService.get(`${ENDPOINTS.staff.list}/next-id`);
}

export async function updateStaff(id: string, payload: any) {
  return apiService.put(ENDPOINTS.staff.update(id), payload);
}

export async function deleteStaff(id: string) {
  return apiService.delete(ENDPOINTS.staff.delete(id));
}

export async function payStaff(id: string, payload?: any) {
  return apiService.post(ENDPOINTS.staff.pay(id), payload || {});
}

export default { listStaff, createStaff, getStaff, updateStaff, deleteStaff, payStaff, getNextStaffId };
