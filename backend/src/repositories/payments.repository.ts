import { query } from '../config/db.js';

export async function createPayment(payload: {
  student_id: number;
  amount: number;
  method: string;
  term_id?: number;
  payment_date?: string;
  notes?: string;
  receipt_number?: string;
}) {
  const receiptNo = payload.receipt_number || 'RCP' + Date.now().toString().slice(-8);

  const res = await query(
    'INSERT INTO payments (student_id, amount, method, term_id, payment_date, notes, receipt_number) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [
      payload.student_id,
      payload.amount,
      payload.method,
      payload.term_id ?? null,
      payload.payment_date || new Date().toISOString().split('T')[0],
      payload.notes || null,
      receiptNo
    ]
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
