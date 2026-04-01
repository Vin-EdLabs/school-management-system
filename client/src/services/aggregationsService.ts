import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function getAggregations(filters?: any): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.aggregations);
}

export async function feesByTerm(termId: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/fees/term/${termId}`);
}

export async function incomeByYear(year: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/income/year/${year}`);
}

export async function expensesByYear(year: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/expenses/year/${year}`);
}

export default { getAggregations, feesByTerm, incomeByYear, expensesByYear };
