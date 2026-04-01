import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listSubjects() {
  return apiService.get(ENDPOINTS.subjects.list);
}

export async function getSubject(id: number) {
  return apiService.get(ENDPOINTS.subjects.get(String(id)));
}

export async function createSubject(data: any) {
  return apiService.post(ENDPOINTS.subjects.create, data);
}

export async function deleteSubject(id: number | string) {
  return apiService.delete(ENDPOINTS.subjects.delete(String(id)));
}

export default { listSubjects, getSubject, createSubject, deleteSubject };
