import { query } from '../config/db.js';

export async function createClass(payload: { level: string; stream?: string; max_class_size?: number }) {
  const res = await query('INSERT INTO classes (level, stream, max_class_size, meta) VALUES ($1, $2, $3, $4) RETURNING *', [payload.level, payload.stream ?? null, payload.max_class_size ?? 30, JSON.stringify({})]);
  return res.rows[0];
}

export async function getClassById(id: number) {
  const res = await query('SELECT * FROM classes WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function updateClass(id: number, payload: any) {
  const setClauses = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (payload.teacher_id !== undefined) {
    setClauses.push(`teacher_id = $${paramIndex++}`);
    values.push(payload.teacher_id ?? null);
  }
  if (payload.level !== undefined) {
    setClauses.push(`level = $${paramIndex++}`);
    values.push(payload.level ?? null);
  }
  if (payload.stream !== undefined) {
    setClauses.push(`stream = $${paramIndex++}`);
    values.push(payload.stream ?? null);
  }
  if (payload.max_class_size !== undefined) {
    setClauses.push(`max_class_size = $${paramIndex++}`);
    values.push(payload.max_class_size ?? 30);
  }

  if (setClauses.length === 0) return getClassById(id);

  values.push(id);
  const sql = `UPDATE classes SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`;
  await query(sql, values);
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

export async function listClasses(limit = 500) {
  const res = await query('SELECT * FROM classes ORDER BY id DESC LIMIT $1', [limit]);
  return res.rows;
}
