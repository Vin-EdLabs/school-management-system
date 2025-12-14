import { query } from '../config/db.js';

export async function createSubject(payload: { code?: string; name: string; description?: string; teacher_id?: number; created_by?: number }) {
  const res = await query(
    `INSERT INTO subjects (code, name, description, teacher_id, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [payload.code || null, payload.name, payload.description || null, payload.teacher_id || null, payload.created_by || null]
  );
  return res.rows[0];
}

export async function listSubjects() {
  const res = await query(`SELECT s.*, u.username as teacher_username FROM subjects s LEFT JOIN users u ON s.teacher_id = u.id ORDER BY s.name`);
  return res.rows;
}

export async function getSubject(id: number) {
  const res = await query(`SELECT s.*, u.username as teacher_username FROM subjects s LEFT JOIN users u ON s.teacher_id = u.id WHERE s.id = $1 LIMIT 1`, [id]);
  return res.rows[0];
}

export default { createSubject, listSubjects, getSubject };
