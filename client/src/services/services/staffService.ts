import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

const STAFF = '/staff';

export async function listStaff(): Promise<{ data: any[] }> {
  return apiService.get(STAFF);
}

export async function createStaff(payload: any): Promise<{ data: any }> {
  return apiService.post(STAFF, payload);
}

export async function updateStaff(id: string, payload: any) {
  return apiService.put(`${STAFF}/${id}`, payload);
}

export async function deleteStaff(id: string) {
  return apiService.delete(`${STAFF}/${id}`);
}

export async function payStaff(id: string, payload?: any) {
  // POST to /staff/:id/pay to record a payment
  return apiService.post(`${STAFF}/${id}/pay`, payload || {});
}

export default { listStaff, createStaff, updateStaff, deleteStaff, payStaff };
