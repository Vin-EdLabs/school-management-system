import type { CreateStudentPayload, Student } from '../../types/student';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listStudents(): Promise<{ data: Student[] }> {
  return apiService.get(ENDPOINTS.students);
}

export async function createStudent(payload: CreateStudentPayload): Promise<{ data: Student }> {
  return apiService.post(ENDPOINTS.students, payload);
}

export async function getStudent(id: number): Promise<{ data: Student }> {
  return apiService.get(`${ENDPOINTS.students}/${id}`);
}

export async function updateStudent(id: number, payload: Partial<CreateStudentPayload>) {
  return apiService.put(`${ENDPOINTS.students}/${id}`, payload);
}

export async function deleteStudent(id: number) {
  return apiService.delete(`${ENDPOINTS.students}/${id}`);
}

export default { listStudents, createStudent, getStudent, updateStudent, deleteStudent };
