import type { Expense, Income } from '../../types/money';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listIncome(): Promise<{ data: Income[] }> {
  return apiService.get(ENDPOINTS.income);
}

export async function createIncome(payload: Partial<Income>): Promise<{ data: Income }> {
  return apiService.post(ENDPOINTS.income, payload);
}

export async function listExpenses(): Promise<{ data: Expense[] }> {
  return apiService.get(ENDPOINTS.expenses);
}

export async function createExpense(payload: Partial<Expense>): Promise<{ data: Expense }> {
  return apiService.post(ENDPOINTS.expenses, payload);
}

export async function expensesByYear(year: number) {
  return apiService.get(`${ENDPOINTS.expenses}/year/${year}`);
}

export async function incomeByYear(year: number) {
  return apiService.get(`${ENDPOINTS.income}/year/${year}`);
}

export default { listIncome, createIncome, listExpenses, createExpense, expensesByYear, incomeByYear };
