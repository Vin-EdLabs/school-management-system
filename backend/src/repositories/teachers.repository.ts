import { query } from '../config/db.js';

function normalizeRow(row: any) {
  if (!row) return null;
  let meta = {};
  try {
    if (row.meta) meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
  } catch (e) {
    meta = {};
  }

  const email = row.email ?? meta.email ?? null;
  const displayName = row.display_name ?? meta.displayName ?? meta.display_name ?? null;

  return {
    id: row.id,
    username: row.username,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
    email,
    displayName,
    meta
  };
}

export async function listTeachers(limit = 1000) {
  const res = await query('SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2', ['teacher', limit]);
  return res.rows.map(normalizeRow);
}

export async function findTeacherById(id: number) {
  const res = await query('SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE id = $1 AND role = $2 LIMIT 1', [id, 'teacher']);
  return normalizeRow(res.rows[0]);
}

export async function createTeacher(payload: any) {
  // kept for compatibility but prefer using user.repository.createUser
  const res = await query('INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, updated_at, email, display_name', [payload.username, payload.password_hash ?? '', 'teacher', JSON.stringify(payload.meta ?? {})]);
  return normalizeRow(res.rows[0]);
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
