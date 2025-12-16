import * as classesRepo from '../repositories/classes.repository.js';
import * as schedulesService from './schedules.service.js';

export async function createClass(payload: { teacher_id?: number; level: string; stream?: string; max_class_size?: number }) {
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

export async function listClasses(user?: any, limit = 500) {
  // If a teacher calls this, return only classes assigned to them and classes
  // they have scheduled via the timetable (to keep the teacher view scoped).
  try {
    if (user && (user.role === 'teacher' || user.role === 'instructor')) {
      const teacherId = Number(user.id);
      const assigned = await classesRepo.listClassesAssignedToTeacher(teacherId);
      // get scheduled classes via schedules service
      const schedules = await schedulesService.listByTeacher(teacherId);
      const scheduledClasses = schedules
        .map((s: any) => ({ id: s.class_id, name: s.class_name ?? null, level: s.level ?? null, stream: s.stream ?? null }))
        // unique by id
        .filter((v: any, i: number, a: any[]) => a.findIndex(x => x.id === v.id) === i);

      // merge assigned and scheduled, preferring assigned class fields
      const mergedMap: Record<string, any> = {};
      for (const c of scheduledClasses) mergedMap[String(c.id)] = c;
      for (const c of assigned) mergedMap[String(c.id)] = { ...mergedMap[String(c.id)] ?? {}, ...c };
      return Object.values(mergedMap);
    }
  } catch (e) {
    // fallback to returning all classes on error
  }
  return classesRepo.listClasses(limit);
}
