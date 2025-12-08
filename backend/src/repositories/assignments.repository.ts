import { query } from '../config/db.js';

export async function addAssignment(teacherId: number, classId: number) {
  await query('INSERT INTO teacher_classes (teacher_id, class_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [teacherId, classId]);
  return { teacher_id: teacherId, class_id: classId };
}

export async function removeAssignment(teacherId: number, classId: number) {
  await query('DELETE FROM teacher_classes WHERE teacher_id = $1 AND class_id = $2', [teacherId, classId]);
  return { teacher_id: teacherId, class_id: classId };
}

export async function listByTeacher(teacherId: number) {
  const res = await query('SELECT c.* FROM classes c JOIN teacher_classes tc ON c.id = tc.class_id WHERE tc.teacher_id = $1', [teacherId]);
  return res.rows;
}

export async function listByClass(classId: number) {
  const res = await query('SELECT u.* FROM users u JOIN teacher_classes tc ON u.id = tc.teacher_id WHERE tc.class_id = $1', [classId]);
  return res.rows;
}

export default { addAssignment, removeAssignment, listByTeacher, listByClass };
