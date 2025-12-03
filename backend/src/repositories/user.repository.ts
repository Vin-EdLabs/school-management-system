import { query } from '../config/db.js';

function normalizeMetaRow(row: any) {
  if (!row) return null;
  // meta may be returned as an object or as a JSON string depending on driver
  let meta = {};
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
    email,
    displayName,
    meta
  };
}

export async function findByUsername(username: string) {
  // Try the richer select first (includes email/display_name if available)
  try {
    const res = await query('SELECT id, username, password_hash, role, email, display_name, meta, created_at, updated_at FROM users WHERE username = $1 LIMIT 1', [username]);
    return normalizeMetaRow(res.rows[0]);
  } catch (err) {
    // Fall back to safer select for older schemas without email/display_name
    const res = await query('SELECT id, username, password_hash, role, meta, created_at, updated_at FROM users WHERE username = $1 LIMIT 1', [username]);
    return normalizeMetaRow(res.rows[0]);
  }
}

export async function createUser(username: string, passwordHash: string, role = 'staff', meta: any = {}) {
  const res = await query('INSERT INTO users (username, password_hash, role, meta) VALUES ($1, $2, $3, $4) RETURNING id, username, role, meta, created_at, updated_at, email, display_name', [username, passwordHash, role, JSON.stringify(meta ?? {})]);
  return normalizeMetaRow(res.rows[0]);
}
