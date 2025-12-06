import { query } from '../config/db.js';

function normalizeRow(row: any) {
  if (!row) return null;
  let meta: any = {};
  try {
    if (row.meta) meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
  } catch (e) {
    meta = {};
  }

  const email = row.email ?? meta?.email ?? null;
  const displayName = row.display_name ?? meta?.displayName ?? meta?.display_name ?? null;

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

export async function listStaff(limit = 1000) {
  const attempts = [
    'SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2',
    'SELECT id, username, role, created_at, meta, email, display_name FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2',
    'SELECT id, username, role, created_at, meta FROM users WHERE role = $1 ORDER BY id DESC LIMIT $2'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, ['staff', limit]);
      return res.rows.map(normalizeRow);
    } catch (err) {
      continue;
    }
  }

  return [];
}

export async function findStaffById(id: number) {
  const attempts = [
    'SELECT id, username, role, created_at, updated_at, meta, email, display_name FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    'SELECT id, username, role, created_at, meta, email, display_name FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    'SELECT id, username, role, created_at, meta FROM users WHERE id = $1 AND role = $2 LIMIT 1'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [id, 'staff']);
      return normalizeRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  return null;
}

export async function createStaff(payload: any) {
  // kept for compatibility but prefer using user.repository.createUser
  const attempts = [
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, updated_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [payload.username, payload.password_hash ?? '', 'staff', JSON.stringify(payload.meta ?? {})]);
      return normalizeRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  throw new Error('Failed to create staff member');
}

export async function updateStaff(id: number, payload: any) {
  const attempts = [
    'UPDATE users SET meta = $1, updated_at = now() WHERE id = $2 AND role = $3 RETURNING id, username, role, meta, created_at, updated_at, email, display_name',
    'UPDATE users SET meta = $1, updated_at = now() WHERE id = $2 AND role = $3 RETURNING id, username, role, meta, created_at, email, display_name',
    'UPDATE users SET meta = $1 WHERE id = $2 AND role = $3 RETURNING id, username, role, meta, created_at'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [JSON.stringify(payload.meta ?? {}), id, 'staff']);
      if (res.rows.length === 0) return null;
      return normalizeRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  throw new Error('Failed to update staff member');
}

export async function deleteStaff(id: number) {
  const attempts = [
    'DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id',
    'DELETE FROM users WHERE id = $1 AND role = $2'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [id, 'staff']);
      return res.rows.length > 0;
    } catch (err) {
      continue;
    }
  }

  return false;
}

export default { listStaff, findStaffById, createStaff, updateStaff, deleteStaff };
