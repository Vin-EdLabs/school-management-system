
import { query } from '../config/db.js';

const ROLE = 'staff';

const COLS_FULL = 'id, staff_id, role, created_at, updated_at, email, display_name, phone, gender, date_of_birth, address, employment_date, employment_status, monthly_salary, notes';
const COLS_MIN = 'id, staff_id, role, created_at, email, display_name';

function normalizeRow(row: any) {
  if (!row) return null;
  return {
    ...row,
    staffId: row.staff_id ?? null,
    displayName: row.display_name ?? null,
    monthlySalary: row.monthly_salary ? Number(row.monthly_salary) : 0
  };
}

export async function listStaff(limit = 1000) {
  try {
    const res = await query(
      `SELECT ${COLS_FULL} FROM users WHERE role NOT IN ('teacher', 'super-admin', 'administrator', 'finance') ORDER BY id DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map(normalizeRow);
  } catch {
    const res = await query(
      `SELECT ${COLS_MIN} FROM users WHERE role NOT IN ('teacher', 'super-admin', 'administrator', 'finance') ORDER BY id DESC LIMIT $1`,
      [limit]
    );
    return res.rows.map(normalizeRow);
  }
}

export async function findStaffById(id: number) {
  try {
    const res = await query(
      `SELECT ${COLS_FULL} FROM users WHERE id = $1 AND role NOT IN ('teacher', 'super-admin', 'administrator', 'finance') LIMIT 1`,
      [id]
    );
    return normalizeRow(res.rows[0] ?? null);
  } catch {
    const res = await query(
      `SELECT ${COLS_MIN} FROM users WHERE id = $1 AND role NOT IN ('teacher', 'super-admin', 'administrator', 'finance') LIMIT 1`,
      [id]
    );
    return normalizeRow(res.rows[0] ?? null);
  }
}

export async function createStaff(payload: any) {
  const staffId = payload.staffId ?? payload.staff_id ?? null;
  const passwordHash = payload.password_hash || '';
  const role = payload.role || ROLE;

  const res = await query(
    `INSERT INTO users (staff_id, password_hash, role, email, display_name, phone, gender, date_of_birth, address, employment_date, employment_status, monthly_salary, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING ${COLS_FULL}`,
    [
      staffId, passwordHash, role, payload.email ?? null, payload.displayName ?? payload.display_name ?? payload.name ?? null,
      payload.phone ?? null, payload.gender ?? null, payload.date_of_birth ?? null,
      payload.address ?? null, payload.employment_date ?? null, payload.employment_status ?? payload.employmentStatus ?? 'active',
      payload.monthly_salary ?? payload.monthlySalary ?? 0, payload.notes ?? null
    ]
  );
  return normalizeRow(res.rows[0]);
}

export async function updateStaff(id: number, payload: any) {
  const fields = [
    'email', 'display_name', 'phone', 'gender', 'date_of_birth', 'address',
    'employment_date', 'employment_status', 'monthly_salary', 'notes'
  ];

  const updates: string[] = [];
  const values: any[] = [];
  let idx = 1;

  for (const f of fields) {
    let key = f;
    if (f === 'monthly_salary') {
      key = payload.monthly_salary !== undefined ? 'monthly_salary' : 'monthlySalary';
    } else if (f === 'display_name') {
      key = payload.display_name !== undefined ? 'display_name' : (payload.displayName !== undefined ? 'displayName' : 'name');
    } else if (f === 'employment_status') {
      key = payload.employment_status !== undefined ? 'employment_status' : 'employmentStatus';
    }

    if (payload[key] !== undefined) {
      updates.push(`${f} = $${idx++}`);
      values.push(payload[key]);
    }
  }

  if (updates.length > 0) {
    values.push(id);
    const sql = `UPDATE users SET ${updates.join(', ')}, updated_at = now() WHERE id = $${idx++} AND role NOT IN ('teacher', 'super-admin', 'administrator', 'finance') RETURNING ${COLS_FULL}`;
    const res = await query(sql, values);
    if (res.rows.length === 0) return null;
    return normalizeRow(res.rows[0]);
  }

  return findStaffById(id);
}

export async function deleteStaff(id: number) {
  await query("DELETE FROM users WHERE id = $1 AND role NOT IN ('teacher', 'super-admin', 'administrator', 'finance')", [id]);
  return { deleted: true };
}

export default { listStaff, findStaffById, createStaff, updateStaff, deleteStaff };
