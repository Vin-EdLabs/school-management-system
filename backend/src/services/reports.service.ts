import { query } from '../config/db.js';

export async function getSummary() {
  // fees collected (payments), income, expenses
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments');
  const incomeRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM income');
  const expensesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM expenses');
  return {
    feesCollected: Number(feesRes.rows[0].total || 0),
    otherIncome: Number(incomeRes.rows[0].total || 0),
    expenses: Number(expensesRes.rows[0].total || 0),
    net: Number((feesRes.rows[0].total || 0) + (incomeRes.rows[0].total || 0) - (expensesRes.rows[0].total || 0)),
  };
}

export async function getTermAggregates(termId: number) {
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE term_id = $1', [termId]);
  return { feesCollected: Number(feesRes.rows[0].total || 0) };
}

export async function getYearAggregates(year: number) {
  const incomeRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM income WHERE year = $1', [year]);
  const expensesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE year = $1', [year]);
  const feesRes = await query('SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE EXTRACT(YEAR FROM created_at) = $1', [year]);
  return {
    fees: Number(feesRes.rows[0].total || 0),
    income: Number(incomeRes.rows[0].total || 0),
    expenses: Number(expensesRes.rows[0].total || 0),
  };
}

export async function getTrends() {
  // monthly totals for payments as simple example
  const res = await query(
    `SELECT to_char(created_at, 'YYYY-MM') as month, COALESCE(SUM(amount),0) as total FROM payments GROUP BY month ORDER BY month DESC LIMIT 12`
  );
  return res.rows;
}
