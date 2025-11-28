import { query } from '../config/db.js';

export async function createClass(payload: { name: string; teacher_id?: number; meta?: any }) {
  const res = await query('INSERT INTO classes (name, teacher_id, meta) VALUES ($1, $2, $3) RETURNING *', [payload.name, payload.teacher_id ?? null, JSON.stringify(payload.meta ?? {})]);
  return res.rows[0];
}

export async function getClassById(id: number) {
  const res = await query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function updateClass(id: number, payload: any) {
  await query('UPDATE classes SET meta = $1, name = $2, teacher_id = $3 WHERE id = $4', [JSON.stringify(payload.meta ?? {}), payload.name, payload.teacher_id ?? null, id]);
  return getClassById(id);
}

export async function deleteClass(id: number) {
  await query('DELETE FROM classes WHERE id = $1', [id]);
  return { deleted: true };
}

export async function getClassStudents(id: number) {
  const res = await query('SELECT * FROM students WHERE class_id = $1', [id]);
  return res.rows;
}
