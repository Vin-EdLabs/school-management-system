import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listTeachers(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.teachers.list);
}

export async function createTeacher(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.teachers.create, payload);
}

export async function getTeacher(id: string | number): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.teachers.get(id.toString()));
}

export async function updateTeacher(id: string | number, payload: any) {
  return apiService.put(ENDPOINTS.teachers.update(id.toString()), payload);
}

export async function deleteTeacher(id: string | number) {
  return apiService.delete(ENDPOINTS.teachers.delete(id.toString()));
}

export default { listTeachers, createTeacher, getTeacher, updateTeacher, deleteTeacher };
