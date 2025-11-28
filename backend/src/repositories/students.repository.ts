import { query } from '../config/db.js';

export async function createStudent(payload: any) {
  const res = await query('INSERT INTO students (first_name, last_name, meta) VALUES ($1, $2, $3) RETURNING id, first_name, last_name', [
    payload.first_name,
    payload.last_name,
    JSON.stringify(payload.meta ?? {}),
  ]);
  return res.rows[0];
}

export async function findStudentById(id: number) {
  const res = await query('SELECT * FROM students WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function updateStudent(id: number, payload: any) {
  // simple updater for demo
  await query('UPDATE students SET meta = $1 WHERE id = $2', [JSON.stringify(payload.meta ?? {}), id]);
  return findStudentById(id);
}

export async function searchStudents(q: string) {
  const res = await query("SELECT * FROM students WHERE first_name ILIKE $1 OR last_name ILIKE $1 LIMIT 100", ['%' + q + '%']);
  return res.rows;
}
