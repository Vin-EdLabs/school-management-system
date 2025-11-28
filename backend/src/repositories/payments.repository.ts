import { query } from '../config/db.js';

export async function createPayment(payload: { student_id: number; amount: number; method: string; term_id?: number; meta?: any }) {
  const res = await query(
    'INSERT INTO payments (student_id, amount, method, term_id, meta) VALUES ($1, $2, $3, $4, $5) RETURNING id, student_id, amount, method, term_id, created_at',
    [payload.student_id, payload.amount, payload.method, payload.term_id ?? null, JSON.stringify(payload.meta ?? {})]
  );
  return res.rows[0];
}

export async function findPayments(filter: Record<string, any> = {}) {
  // simple implementation; caller should expand filters
  const res = await query('SELECT * FROM payments ORDER BY created_at DESC LIMIT 500');
  return res.rows;
}

export async function findById(id: number) {
  const res = await query('SELECT * FROM payments WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function findByStudent(studentId: number) {
  const res = await query('SELECT * FROM payments WHERE student_id = $1 ORDER BY created_at DESC', [studentId]);
  return res.rows;
}
