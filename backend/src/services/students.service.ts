import * as studentsRepo from '../repositories/students.repository.js';

export async function createStudent(payload: any) {
  return studentsRepo.createStudent(payload);
}

export async function getStudent(id: number) {
  return studentsRepo.findStudentById(id);
}

export async function updateStudent(id: number, payload: any) {
  return studentsRepo.updateStudent(id, payload);
}

export async function searchStudents(q: string) {
  return studentsRepo.searchStudents(q);
}
