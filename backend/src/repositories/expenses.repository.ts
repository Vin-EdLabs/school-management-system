import { query } from '../config/db.js';

export async function createExpense(payload: { amount: number; description?: string; category?: string; year?: number; meta?: any }) {
  const res = await query('INSERT INTO expenses (amount, description, category, year, meta) VALUES ($1, $2, $3, $4, $5) RETURNING *', [payload.amount, payload.description ?? null, payload.category ?? null, payload.year ?? null, JSON.stringify(payload.meta ?? {})]);
  return res.rows[0];
}

export async function updateExpense(id: number, payload: any) {
  await query('UPDATE expenses SET amount = $1, description = $2, category = $3, year = $4, meta = $5 WHERE id = $6', [payload.amount, payload.description ?? null, payload.category ?? null, payload.year ?? null, JSON.stringify(payload.meta ?? {}), id]);
  const res = await query('SELECT * FROM expenses WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function deleteExpense(id: number) {
  await query('DELETE FROM expenses WHERE id = $1', [id]);
  return { deleted: true };
}

export async function listExpensesByYear(year: number) {
  const res = await query('SELECT * FROM expenses WHERE year = $1 ORDER BY created_at DESC', [year]);
  return res.rows;
}

export async function listCategories() {
  const res = await query('SELECT DISTINCT category FROM expenses');
  return res.rows.map((r) => r.category).filter(Boolean);
}
