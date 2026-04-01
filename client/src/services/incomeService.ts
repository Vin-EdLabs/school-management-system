import type { Income } from '../types/money';
import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listIncome(): Promise<{ data: Income[] }> {
  return apiService.get(ENDPOINTS.income.list);
}

export async function createIncome(payload: Partial<Income>) {
  return apiService.post(ENDPOINTS.income.list, payload);
}

export async function getIncome(id: string) {
  return apiService.get(ENDPOINTS.income.get(id));
}

export async function deleteIncome(id: string) {
  return apiService.delete(ENDPOINTS.income.delete(id));
}

export default { listIncome, createIncome, getIncome, deleteIncome };
