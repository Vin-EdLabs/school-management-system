import type { Expense } from '../types/money';
import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listExpenses(): Promise<{ data: Expense[] }> {
  return apiService.get(ENDPOINTS.expenses.list);
}

export async function createExpense(payload: Partial<Expense>) {
  return apiService.post(ENDPOINTS.expenses.list, payload);
}

export async function getExpense(id: string) {
  return apiService.get(ENDPOINTS.expenses.get(id));
}

export async function deleteExpense(id: string) {
  return apiService.delete(ENDPOINTS.expenses.delete(id));
}

export default { listExpenses, createExpense, getExpense, deleteExpense };
