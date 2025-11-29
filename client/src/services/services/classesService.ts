import type { SchoolClass } from '../../types/class';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listClasses(): Promise<{ data: SchoolClass[] }> {
  return apiService.get(ENDPOINTS.classes);
}

export async function createClass(payload: Partial<SchoolClass>): Promise<{ data: SchoolClass }> {
  return apiService.post(ENDPOINTS.classes, payload);
}

export async function getClass(id: number): Promise<{ data: SchoolClass }> {
  return apiService.get(`${ENDPOINTS.classes}/${id}`);
}

export async function getClassStudents(id: number) {
  return apiService.get(`${ENDPOINTS.classes}/${id}/students`);
}

export async function updateClass(id: number | string, payload: Partial<SchoolClass>) {
  return apiService.put(`${ENDPOINTS.classes}/${id}`, payload);
}

export async function deleteClass(id: number | string) {
  return apiService.delete(`${ENDPOINTS.classes}/${id}`);
}

export default { listClasses, createClass, getClass, getClassStudents };
