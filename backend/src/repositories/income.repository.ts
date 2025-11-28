import { query } from '../config/db.js';

export async function createIncome(payload: { amount: number; description?: string; year?: number; meta?: any }) {
  const res = await query('INSERT INTO income (amount, description, year, meta) VALUES ($1, $2, $3, $4) RETURNING *', [payload.amount, payload.description ?? null, payload.year ?? null, JSON.stringify(payload.meta ?? {})]);
  return res.rows[0];
}

export async function updateIncome(id: number, payload: any) {
  await query('UPDATE income SET amount = $1, description = $2, year = $3, meta = $4 WHERE id = $5', [payload.amount, payload.description ?? null, payload.year ?? null, JSON.stringify(payload.meta ?? {}), id]);
  const res = await query('SELECT * FROM income WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function deleteIncome(id: number) {
  await query('DELETE FROM income WHERE id = $1', [id]);
  return { deleted: true };
}

export async function listIncomeByYear(year: number) {
  const res = await query('SELECT * FROM income WHERE year = $1 ORDER BY created_at DESC', [year]);
  return res.rows;
}
