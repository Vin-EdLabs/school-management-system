import { query } from '../config/db.js';

export async function createExpense(payload: {
  amount: number;
  description?: string;
  category?: string;
  year?: number;
  title?: string;
  payee_name?: string;
  payeeName?: string;
  payment_date?: string;
  paymentDate?: string;
  method?: string;
  paymentMethod?: string;
  purpose?: string;
  notes?: string;
}) {
  const date = (payload.payment_date ?? payload.paymentDate ?? new Date().toISOString().split('T')[0]) as string;
  const year = payload.year || new Date(date).getFullYear();
  const res = await query(
    'INSERT INTO expenses (amount, description, category, year, title, payee_name, payment_date, method, purpose, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
    [
      payload.amount,
      payload.description ?? payload.purpose ?? payload.notes ?? null,
      payload.category ?? null,
      year,
      payload.title ?? null,
      payload.payee_name ?? payload.payeeName ?? null,
      date,
      payload.method ?? payload.paymentMethod ?? null,
      payload.purpose ?? payload.description ?? null,
      payload.notes ?? null
    ]
  );
  return res.rows[0];
}

export async function updateExpense(id: number, payload: any) {
  const dateInput = payload.payment_date ?? payload.paymentDate;
  const year = payload.year || (typeof dateInput === 'string' ? new Date(dateInput).getFullYear() : undefined);
  await query(
    'UPDATE expenses SET amount = $1, description = $2, category = $3, year = COALESCE($4, year), title = $5, payee_name = $6, payment_date = $7, method = $8, purpose = $9, notes = $10 WHERE id = $11',
    [
      payload.amount,
      payload.description ?? payload.purpose ?? payload.notes ?? null,
      payload.category ?? null,
      year ?? null,
      payload.title ?? null,
      payload.payee_name ?? payload.payeeName ?? null,
      dateInput ?? null,
      payload.method ?? payload.paymentMethod ?? null,
      payload.purpose ?? payload.description ?? null,
      payload.notes ?? null,
      id
    ]
  );
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

export async function listAllExpenses() {
  const res = await query('SELECT * FROM expenses ORDER BY created_at DESC');
  return res.rows;
}

export async function getExpenseById(id: number) {
  const res = await query('SELECT * FROM expenses WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}
