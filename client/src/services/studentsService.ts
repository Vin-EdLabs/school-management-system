import type { CreateStudentPayload, Student } from '../types/student';
import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listStudents(): Promise<{ data: Student[] }> {
  return apiService.get(ENDPOINTS.students.list);
}

export async function createStudent(payload: CreateStudentPayload): Promise<{ data: Student }> {
  return apiService.post(ENDPOINTS.students.create, payload);
}

export async function getStudent(id: number): Promise<{ data: Student }> {
  return apiService.get(ENDPOINTS.students.get(id.toString()));
}

export async function updateStudent(id: number, payload: Partial<CreateStudentPayload>) {
  return apiService.put(ENDPOINTS.students.update(id.toString()), payload);
}

export async function deleteStudent(id: number) {
  return apiService.delete(ENDPOINTS.students.delete(id.toString()));
}

export default { listStudents, createStudent, getStudent, updateStudent, deleteStudent };
