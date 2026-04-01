import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listClasses(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.classes.list);
}

export async function createClass(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.classes.create, payload);
}

export async function getClass(id: string | number): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.classes.get(id.toString()));
}

export async function updateClass(id: string | number, payload: any) {
  return apiService.put(ENDPOINTS.classes.update(id.toString()), payload);
}

export async function deleteClass(id: string | number) {
  return apiService.delete(ENDPOINTS.classes.delete(id.toString()));
}

export async function getClassStudents(id: string | number): Promise<{ data: any[] }> {
  return apiService.get(`${ENDPOINTS.classes.get(id.toString())}/students`);
}

export default { listClasses, createClass, getClass, updateClass, deleteClass, getClassStudents };
