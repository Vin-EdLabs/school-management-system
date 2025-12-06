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
  const attempts = [
    'SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2',
    'SELECT id, username, role, created_at, meta, email, display_name FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2',
    'SELECT id, username, role, created_at, meta FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, ['teacher', limit]);
      return res.rows.map(normalizeRow);
    } catch (err) {
      continue;
    }
  }

  return [];
}

export async function findTeacherById(id: number) {
  const attempts = [
    'SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    'SELECT id, username, role, created_at, meta, email, display_name FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    'SELECT id, username, role, created_at, meta FROM users WHERE id = $1 AND role = $2 LIMIT 1'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [id, 'teacher']);
      return normalizeRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  return null;
}

export async function createTeacher(payload: any) {
  // kept for compatibility but prefer using user.repository.createUser
  const attempts = [
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, updated_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [payload.username, payload.password_hash ?? '', 'teacher', JSON.stringify(payload.meta ?? {})]);
      return normalizeRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  throw new Error('Failed to insert teacher into users with expected RETURNING columns');
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
