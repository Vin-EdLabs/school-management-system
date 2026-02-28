import { query } from '../config/db.js';

const ROLE = 'teacher';

// Base columns -- no meta, no subjects_taught array
const COLS = `
  u.id, u.staff_id, u.role, u.display_name, u.email, u.phone, u.gender,
  u.date_of_birth, u.address, u.employment_date, u.employment_status,
  u.monthly_salary, u.notes, u.created_at, u.updated_at,
  COALESCE(
    (SELECT array_agg(s.name ORDER BY s.name)
     FROM teacher_subjects ts JOIN subjects s ON s.id = ts.subject_id
     WHERE ts.teacher_id = u.id),
  '{}') AS subjects_taught
`.trim();

function normalizeRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    staff_id: row.staff_id,
    role: row.role,
    display_name: row.display_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    gender: row.gender ?? null,
    date_of_birth: row.date_of_birth ?? null,
    address: row.address ?? null,
    employment_date: row.employment_date ?? null,
    employment_status: row.employment_status ?? 'Active',
    monthly_salary: row.monthly_salary ?? 0,
    monthlySalary: row.monthly_salary ?? 0,
    notes: row.notes ?? null,
    subjects_taught: Array.isArray(row.subjects_taught) ? row.subjects_taught
      : row.subjects_taught ? [row.subjects_taught] : [],
    created_at: row.created_at,
    updated_at: row.updated_at ?? null,
  };
}

export async function listTeachers() {
  const res = await query(
    `SELECT ${COLS} FROM users u WHERE u.role = $1 ORDER BY u.display_name ASC NULLS LAST`,
    [ROLE]
  );
  return res.rows.map(normalizeRow);
}

export async function findTeacherById(id: number) {
  const res = await query(
    `SELECT ${COLS} FROM users u WHERE u.role = $1 AND u.id = $2 LIMIT 1`,
    [ROLE, id]
  );
  return normalizeRow(res.rows[0] ?? null);
}

export async function findTeacherByStaffId(staffId: string) {
  const res = await query(
    `SELECT ${COLS} FROM users u WHERE u.role = $1 AND u.staff_id = $2 LIMIT 1`,
    [ROLE, staffId]
  );
  return normalizeRow(res.rows[0] ?? null);
}

export async function createTeacher(payload: any) {
  // 1. Insert base user row
  const res = await query(
    `INSERT INTO users (
       staff_id, password_hash, role,
       display_name, email, phone, gender,
       date_of_birth, address, employment_date, employment_status,
       monthly_salary, notes
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [
      payload.staff_id ?? null,
      payload.password_hash ?? '',
      ROLE,
      payload.display_name ?? null,
      payload.email ?? null,
      payload.phone ?? null,
      payload.gender ?? null,
      payload.date_of_birth || null,
      payload.address ?? null,
      payload.employment_date || null,
      payload.employment_status ?? 'Active',
      payload.monthly_salary ?? payload.monthlySalary ?? 0,
      payload.notes ?? null,
    ]
  );
  const newId = res.rows[0]?.id;
  if (!newId) throw new Error('Insert returned no id');

  // 2. Link subjects via teacher_subjects
  await linkSubjects(newId, payload.subjects_taught ?? []);

  return findTeacherById(newId);
}

/** Link a teacher to a list of subject names (replace existing). */
async function linkSubjects(teacherId: number, subjectNames: string[]) {
  // Remove all existing links for this teacher
  await query('DELETE FROM teacher_subjects WHERE teacher_id = $1', [teacherId]);
  if (!subjectNames || subjectNames.length === 0) return;
  // Look up subject IDs by name (case-insensitive)
  const subjectRes = await query(
    `SELECT id, name FROM subjects WHERE lower(name) = ANY(ARRAY[${subjectNames.map((_, i) => `$${i + 1}`).join(',')}]::text[])`,
    subjectNames.map(n => n.toLowerCase())
  );
  for (const sub of subjectRes.rows) {
    await query(
      'INSERT INTO teacher_subjects (teacher_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [teacherId, sub.id]
    );
  }
}

export async function updateTeacher(id: number, payload: any) {
  // Verify exists
  const check = await query('SELECT id FROM users WHERE id = $1 AND role = $2 LIMIT 1', [id, ROLE]);
  if (!check.rows[0]) return null;

  // Build SET clause dynamically for only provided scalar fields
  const ALLOWED = [
    'display_name', 'email', 'phone', 'gender', 'date_of_birth', 'address',
    'employment_date', 'employment_status', 'monthly_salary', 'notes', 'staff_id',
  ];
  const sets: string[] = [];
  const vals: any[] = [];

  for (const col of ALLOWED) {
    const key = col === 'monthly_salary' ? (payload.monthly_salary !== undefined ? 'monthly_salary' : 'monthlySalary') : col;
    if (key in payload && payload[key] !== undefined) {
      sets.push(`${col} = $${vals.length + 1}`);
      let val = payload[key];
      if ((col === 'date_of_birth' || col === 'employment_date') && val === '') {
        val = null;
      }
      vals.push(val);
    }
  }
  sets.push('updated_at = NOW()');

  if (sets.length > 1) { // Only update if there are actual scalar fields to change (beyond updated_at)
    vals.push(id, ROLE);
    await query(
      `UPDATE users SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND role = $${vals.length}`,
      vals
    );
  }

  // Update subject links if provided
  if ('subjects_taught' in payload && payload.subjects_taught !== undefined) {
    await linkSubjects(id, payload.subjects_taught);
  }

  return findTeacherById(id);
}

export async function deleteTeacher(id: number) {
  await query('DELETE FROM users WHERE id = $1 AND role = $2', [id, ROLE]);
  return { deleted: true };
}

export default { listTeachers, findTeacherById, findTeacherByStaffId, createTeacher, updateTeacher, deleteTeacher };
