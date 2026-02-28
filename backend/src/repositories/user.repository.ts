
import { query } from '../config/db.js';

const COLS_FULL = 'id, staff_id, role, created_at, updated_at, email, display_name, phone, gender, date_of_birth, address, employment_date, employment_status, monthly_salary, notes, password_changed';

// This normalization is for general user data, including sensitive fields like password_hash
function normalizeUserRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    staffId: row.staff_id ?? null,
    password_hash: row.password_hash,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
    password_changed: row.password_changed ?? false,
    email: row.email ?? null,
    displayName: row.display_name ?? null,
    phone: row.phone ?? null,
    gender: row.gender ?? null,
    date_of_birth: row.date_of_birth ?? null,
    address: row.address ?? null,
    employment_date: row.employment_date ?? null,
    employment_status: row.employment_status ?? null,
    monthly_salary: row.monthly_salary ?? 0,
    notes: row.notes ?? null
  };
}

/** Find a user by their staff_id (the canonical login identifier). */
export async function findByStaffId(staffId: string) {
  const attempts = [
    `SELECT ${COLS_FULL}, password_hash FROM users WHERE staff_id = $1 LIMIT 1`,
    'SELECT id, staff_id, password_hash, role, email, display_name, password_changed, created_at FROM users WHERE staff_id = $1 LIMIT 1',
    'SELECT id, staff_id, password_hash, role, password_changed FROM users WHERE staff_id = $1 LIMIT 1',
    'SELECT id, staff_id, password_hash, role FROM users WHERE staff_id = $1 LIMIT 1',
  ];

  for (const sql of attempts) {
    try {
      const res = await query(sql, [staffId]);
      return normalizeUserRow(res.rows[0] ?? null);
    } catch {
      // column missing — try next variant
    }
  }
  return null;
}

/** @deprecated Use findByStaffId instead */
export const findByUsername = findByStaffId;

export async function findByUserId(id: number) {
  const attempts = [
    `SELECT ${COLS_FULL}, password_hash FROM users WHERE id = $1 LIMIT 1`,
    'SELECT id, staff_id, password_hash, role, email, display_name, password_changed, created_at FROM users WHERE id = $1 LIMIT 1',
    'SELECT id, staff_id, password_hash, role, password_changed FROM users WHERE id = $1 LIMIT 1',
    'SELECT id, staff_id, password_hash, role FROM users WHERE id = $1 LIMIT 1'
  ];
  for (const sql of attempts) {
    try {
      const res = await query(sql, [id]);
      return normalizeUserRow(res.rows[0]);
    } catch (err) {
      continue;
    }
  }
  return null;
}

export async function createUser(staffId: string, passwordHash: string, role = 'staff', _meta: any = {}) {
  // Create a user using `staff_id` as the canonical identifier.
  const params = [staffId, passwordHash, role, false];
  const attempts = [
    'INSERT INTO users (staff_id, password_hash, role, password_changed) VALUES ($1, $2, $3, $4) RETURNING id, staff_id, role, password_changed, created_at, updated_at, email, display_name',
    'INSERT INTO users (staff_id, password_hash, role, password_changed) VALUES ($1, $2, $3, $4) RETURNING id, staff_id, role, password_changed, created_at, email, display_name',
    'INSERT INTO users (staff_id, password_hash, role) VALUES ($1, $2, $3) RETURNING id, staff_id, role'
  ];

  const errors: any[] = [];
  for (const sql of attempts) {
    try {
      const res = await query(sql, params);
      return normalizeUserRow(res.rows[0]);
    } catch (err) {
      errors.push(err);
      continue;
    }
  }

  const lastErr = errors.length ? errors[errors.length - 1] : null;
  const msg = lastErr && lastErr.message ? lastErr.message : 'unknown error';
  throw new Error(`Failed to insert into users with expected RETURNING columns: ${msg}`);
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
  sql += `, updated_at = now() WHERE id = $${params.length + 1} RETURNING id, staff_id, password_hash, role, password_changed, created_at, updated_at, email, display_name`;
  params.push(id);

  try {
    const res = await query(sql, params);
    if (res.rows.length === 0) return null;
    return normalizeUserRow(res.rows[0]);
  } catch (err) {
    // Retry without updated_at if that fails
    const simpleSql = sql.replace(', updated_at = now()', '');
    try {
      const res = await query(simpleSql, params);
      if (res.rows.length === 0) return null;
      return normalizeUserRow(res.rows[0]);
    } catch (e) {
      throw err;
    }
  }
}

export async function getMaxStaffId(): Promise<number> {
  try {
    const res = await query(
      `SELECT MAX(CAST(staff_id AS INTEGER)) AS max_staff FROM users WHERE staff_id ~ '^\\d+$'`
    );
    return Number(res.rows[0]?.max_staff ?? 0);
  } catch {
    return 0;
  }
}
