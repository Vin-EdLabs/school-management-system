import { query } from '../config/db.js';

export async function createSubject(payload: { code?: string; name: string; description?: string; teacher_id?: number; created_by?: number }) {
  const code = payload.code || null;
  const name = payload.name;
  const description = payload.description || null;
  const teacherId = payload.teacher_id || null;
  const createdBy = payload.created_by || null;

  // Try with created_by first; if column doesn't exist fall back without it
  const attempts = [
    {
      sql: `INSERT INTO subjects (code, name, description, teacher_id, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      params: [code, name, description, teacherId, createdBy],
    },
    {
      sql: `INSERT INTO subjects (code, name, description, teacher_id) VALUES ($1,$2,$3,$4) RETURNING *`,
      params: [code, name, description, teacherId],
    },
    {
      sql: `INSERT INTO subjects (name, teacher_id) VALUES ($1,$2) RETURNING *`,
      params: [name, teacherId],
    },
  ];

  for (const { sql, params } of attempts) {
    try {
      const res = await query(sql, params);
      return res.rows[0];
    } catch {
      // column missing — try next variant
    }
  }

  throw new Error('Failed to create subject');
}

export async function listSubjects() {
  const res = await query(
    `SELECT s.*, u.staff_id AS teacher_staff_id
     FROM subjects s
     LEFT JOIN users u ON s.teacher_id = u.id
     ORDER BY s.name`
  );
  return res.rows;
}

export async function getSubject(id: number) {
  const res = await query(
    `SELECT s.*, u.staff_id AS teacher_staff_id
     FROM subjects s
     LEFT JOIN users u ON s.teacher_id = u.id
     WHERE s.id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function deleteSubject(id: number) {
  const res = await query(`DELETE FROM subjects WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] ?? null;
}

export default { createSubject, listSubjects, getSubject, deleteSubject };
