import type { Income } from '../../types/income';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listIncome(): Promise<{ data: Income[] }> {
  return apiService.get(ENDPOINTS.income);
}

export async function createIncome(payload: Partial<Income>) {
  return apiService.post(ENDPOINTS.income, payload);
}

export default { listIncome, createIncome };
