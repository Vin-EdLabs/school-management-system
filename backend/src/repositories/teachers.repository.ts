import { query } from '../config/db.js';

export async function listTeachers(limit = 1000) {
  const res = await query('SELECT id, username, role, created_at FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2', ['teacher', limit]);
  return res.rows;
}

export async function findTeacherById(id: number) {
  const res = await query('SELECT id, username, role, created_at FROM users WHERE id = $1 AND role = $2 LIMIT 1', [id, 'teacher']);
  return res.rows[0];
}

export async function createTeacher(payload: any) {
  // payload should contain username and password_hash (or password handled elsewhere)
  const res = await query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role', [payload.username, payload.password_hash ?? '', 'teacher']);
  return res.rows[0];
}

export async function updateTeacher(id: number, payload: any) {
  await query('UPDATE users SET username = $1 WHERE id = $2 AND role = $3', [payload.username, id, 'teacher']);
  return findTeacherById(id);
}

export async function deleteTeacher(id: number) {
  // soft delete: remove role or mark archived; for now, delete row
  await query('DELETE FROM users WHERE id = $1 AND role = $2', [id, 'teacher']);
  return { deleted: true };
}

export default { listTeachers, findTeacherById, createTeacher, updateTeacher, deleteTeacher };
