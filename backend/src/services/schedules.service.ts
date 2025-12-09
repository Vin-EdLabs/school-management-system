import * as repo from '../repositories/schedules.repository.js';
import { ConflictError } from '../utils/errors.js';

function toTimeString(t: any) {
  if (!t) return null;
  // accept 'HH:MM' or 'HH:MM:SS'
  const s = String(t);
  if (s.length === 5) return s + ':00';
  return s;
}

export async function createSchedule(payload: any) {
  // basic validation
  const start = toTimeString(payload.start_time);
  const end = toTimeString(payload.end_time);
  if (!start || !end) throw new Error('Start and end times are required');
  if (start >= end) throw new Error('Start time must be before end time');

  // check conflicts
  const conflicts = await repo.findConflicts({ class_id: payload.class_id, teacher_id: payload.teacher_id, room: payload.room, day_of_week: payload.day_of_week ?? 0, start_time: start, end_time: end, subject: payload.subject });
  if (conflicts && conflicts.length > 0) {
    throw new ConflictError('Scheduling conflict', { conflicts });
  }

  // create
  return repo.createSchedule({ ...payload, start_time: start, end_time: end });
}

export async function updateSchedule(id: number, payload: any) {
  const start = toTimeString(payload.start_time);
  const end = toTimeString(payload.end_time);
  if (!start || !end) throw new Error('Start and end times are required');
  if (start >= end) throw new Error('Start time must be before end time');

  const conflicts = await repo.findConflicts({ class_id: payload.class_id, teacher_id: payload.teacher_id, room: payload.room, day_of_week: payload.day_of_week ?? 0, start_time: start, end_time: end, subject: payload.subject, excludeId: id });
  if (conflicts && conflicts.length > 0) {
    throw new ConflictError('Scheduling conflict', { conflicts });
  }

  return repo.updateSchedule(id, { ...payload, start_time: start, end_time: end });
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
