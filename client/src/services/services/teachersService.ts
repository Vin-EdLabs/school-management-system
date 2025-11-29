import { apiService } from '../api';

export async function listTeachers(): Promise<{ data: any[] }> {
  return apiService.get('/teachers');
}

export async function createTeacher(payload: any): Promise<{ data: any }> {
  return apiService.post('/teachers', payload);
}

export async function getTeacher(id: string | number): Promise<{ data: any }> {
  return apiService.get(`/teachers/${id}`);
}

export async function updateTeacher(id: string | number, payload: any) {
  return apiService.put(`/teachers/${id}`, payload);
}

export async function deleteTeacher(id: string | number) {
  return apiService.delete(`/teachers/${id}`);
}

export default { listTeachers, createTeacher, getTeacher, updateTeacher, deleteTeacher };
