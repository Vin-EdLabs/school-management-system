import { query } from '../config/db.js';

function normalizeMetaRow(row: any) {
  if (!row) return null;
  // meta may be returned as an object or as a JSON string depending on driver
  let meta: any = {};
  try {
    if (row.meta) {
      meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : row.meta;
    }
  } catch (e) {
    meta = {};
  }

  // Prefer explicit columns if present, otherwise fall back to meta fields
  const email = row.email ?? meta.email ?? null;
  const displayName = row.display_name ?? meta.displayName ?? meta.display_name ?? null;

  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
    password_changed: row.password_changed ?? false,
    email,
    displayName,
    meta
  };
}

export async function findByUsername(username: string) {
  // Try progressively simpler selects to handle schema differences (some DBs lack email/display_name/updated_at)
  const attempts = [
    'SELECT id, username, password_hash, role, email, display_name, meta, password_changed, created_at, updated_at FROM users WHERE username = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, email, display_name, meta, password_changed, created_at FROM users WHERE username = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, meta, password_changed FROM users WHERE username = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, meta FROM users WHERE username = $1 LIMIT 1'
  ];
  for (const sql of attempts) {
    try {
      const res = await query(sql, [username]);
      return normalizeMetaRow(res.rows[0]);
    } catch (err) {
      // try next attempt
      continue;
    }
  }

  // If all attempts fail, return null (caller should handle missing user)
  return null;
}

export async function findByUserId(id: number) {
  const attempts = [
    'SELECT id, username, password_hash, role, email, display_name, meta, password_changed, created_at, updated_at FROM users WHERE id = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, email, display_name, meta, password_changed, created_at FROM users WHERE id = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, meta, password_changed FROM users WHERE id = $1 LIMIT 1',
    'SELECT id, username, password_hash, role, meta FROM users WHERE id = $1 LIMIT 1'
  ];
  for (const sql of attempts) {
    try {
      const res = await query(sql, [id]);
      return normalizeMetaRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }
  return null;
}

export async function createUser(username: string, passwordHash: string, role = 'staff', meta: any = {}) {
  // Try RETURNING with various column sets to support older schemas
  const attempts = [
    'INSERT INTO users (username, password_hash, role, meta, password_changed) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, meta, password_changed, created_at, updated_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta, password_changed) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, meta, password_changed, created_at, email, display_name',
    'INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta'
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [username, passwordHash, role, JSON.stringify(meta ?? {}), false]);
      return normalizeMetaRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }

  throw new Error('Failed to insert into users with expected RETURNING columns');
}

export async function updateUser(id: number, updates: any) {
  // Update password and/or password_changed flag
  let sql = 'UPDATE users SET ';
  const params: any[] = [];
  const parts: string[] = [];

  if (updates.password_hash) {
    parts.push(`password_hash = $${params.length + 1}`);
    params.push(updates.password_hash);
  }

  if (updates.password_changed !== undefined) {
    parts.push(`password_changed = $${params.length + 1}`);
    params.push(updates.password_changed);
  }

  if (parts.length === 0) {
    throw new Error('No fields to update');
  }

  sql += parts.join(', ');
  sql += `, updated_at = now() WHERE id = $${params.length + 1} RETURNING id, username, password_hash, role, password_changed, meta, created_at, updated_at, email, display_name`;
  params.push(id);

  try {
    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return normalizeMetaRow(res.rows[0]);
  } catch (err) {
    // Retry without updated_at if that fails
    const simpleSql = sql.replace(', updated_at = now()', '');
    try {
      const res = await query(simpleSql, params);
      if (res.rows.length === 0) return null;
      return normalizeMetaRow(res.rows[0]);
    } catch (e) {
      throw err;
    }
  }
}
