import * as repo from '../repositories/teachers.repository.js';

export async function listTeachers() {
  return repo.listTeachers();
}

export async function getTeacher(id: number) {
  return repo.findTeacherById(id);
}

export async function createTeacher(payload: any) {
  return repo.createTeacher(payload);
}

export async function updateTeacher(id: number, payload: any) {
  return repo.updateTeacher(id, payload);
}

export async function deleteTeacher(id: number) {
  return repo.deleteTeacher(id);
}

export default { listTeachers, getTeacher, createTeacher, updateTeacher, deleteTeacher };
