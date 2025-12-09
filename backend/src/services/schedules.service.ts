import * as repo from '../repositories/schedules.repository.js';

export async function createSchedule(payload: any) {
  return repo.createSchedule(payload);
}

export async function updateSchedule(id: number, payload: any) {
  return repo.updateSchedule(id, payload);
}

export async function deleteSchedule(id: number) {
  return repo.deleteSchedule(id);
}

export async function listByTeacher(teacherId: number) {
  return repo.listSchedulesByTeacher(teacherId);
}

export async function listByClass(classId: number) {
  return repo.listSchedulesByClass(classId);
}

export async function listAll() {
  return repo.listAllSchedules();
}

export default { createSchedule, updateSchedule, deleteSchedule, listByTeacher, listByClass, listAll };
