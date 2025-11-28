import * as classesRepo from '../repositories/classes.repository.js';

export async function createClass(payload: { name: string; teacher_id?: number; meta?: any }) {
  return classesRepo.createClass(payload);
}

export async function getClass(id: number) {
  return classesRepo.getClassById(id);
}

export async function updateClass(id: number, payload: any) {
  return classesRepo.updateClass(id, payload);
}

export async function deleteClass(id: number) {
  return classesRepo.deleteClass(id);
}

export async function getRoster(id: number) {
  return classesRepo.getClassStudents(id);
}

export async function listClasses(limit = 500) {
  return classesRepo.listClasses(limit);
}
