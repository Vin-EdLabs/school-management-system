import { query } from '../config/db.js';

export async function createIncome(payload: {
  amount: number;
  description?: string;
  year?: number;
  source?: string;
  method?: string;
  received_by?: string;
  date?: string;
  notes?: string;
}) {
  const year = payload.year || (payload.date ? new Date(payload.date).getFullYear() : new Date().getFullYear());
  const res = await query(
    'INSERT INTO income (amount, description, year, source, method, received_by, date, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
    [
      payload.amount,
      payload.description ?? payload.notes ?? null,
      year,
      payload.source ?? null,
      payload.method ?? null,
      payload.received_by ?? null,
      payload.date ?? new Date().toISOString().split('T')[0],
      payload.notes ?? payload.description ?? null
    ]
  );
  return res.rows[0];
}

export async function updateIncome(id: number, payload: any) {
  const year = payload.year || (payload.date ? new Date(payload.date).getFullYear() : undefined);
  await query(
    'UPDATE income SET amount = $1, description = $2, year = COALESCE($3, year), source = $4, method = $5, received_by = $6, date = $7, notes = $8 WHERE id = $9',
    [
      payload.amount,
      payload.description ?? payload.notes ?? null,
      year ?? null,
      payload.source ?? null,
      payload.method ?? null,
      payload.received_by ?? null,
      payload.date ?? null,
      payload.notes ?? payload.description ?? null,
      id
    ]
  );
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

export async function listAllIncome() {
  const res = await query('SELECT * FROM income ORDER BY created_at DESC');
  return res.rows;
}

export async function getIncomeById(id: number) {
  const res = await query('SELECT * FROM income WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] ?? null;
}
