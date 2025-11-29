import type { Expense } from '../../types/expense';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listExpenses(): Promise<{ data: Expense[] }> {
  return apiService.get(ENDPOINTS.expenses);
}

export async function createExpense(payload: Partial<Expense>) {
  return apiService.post(ENDPOINTS.expenses, payload);
}

export default { listExpenses, createExpense };