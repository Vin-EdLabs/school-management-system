import * as repo from '../repositories/assignments.repository.js';

export async function addAssignment(teacherId: number, classId: number) {
  return repo.addAssignment(teacherId, classId);
}

export async function removeAssignment(teacherId: number, classId: number) {
  return repo.removeAssignment(teacherId, classId);
}

export async function listByTeacher(teacherId: number) {
  return repo.listByTeacher(teacherId);
}

export async function listByClass(classId: number) {
  return repo.listByClass(classId);
}

export default { addAssignment, removeAssignment, listByTeacher, listByClass };
