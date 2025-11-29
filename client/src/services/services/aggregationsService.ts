import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function feesByTerm(termId: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/fees/term/${termId}`);
}

export async function incomeByYear(year: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/income/year/${year}`);
}

export async function expensesByYear(year: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/expenses/year/${year}`);
}

export async function netByYear(year: number) {
  return apiService.get(`${ENDPOINTS.aggregations}/net/year/${year}`);
}

export default { feesByTerm, incomeByYear, expensesByYear, netByYear };
