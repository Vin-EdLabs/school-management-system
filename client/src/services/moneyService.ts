import { apiService } from './api';
import ENDPOINTS from './endpoints';

// Money/Financial utilities service
// Handles formatting, calculations, and display logic for financial data

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(amount);
}

export function calculateTotal(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + (item.amount || 0), 0);
}

export function calculateTotalByProperty(items: any[], property: string): number {
  return items.reduce((sum, item) => sum + (item[property] || 0), 0);
}

export function isValidAmount(amount: any): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num >= 0;
}

export async function listIncome(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.income.list);
}

export async function createIncome(payload: any) {
  return apiService.post(ENDPOINTS.income.list, payload);
}

export async function incomeByYear(year: number) {
  return apiService.get(`${ENDPOINTS.income.list}/year/${year}`);
}

export async function listExpenses(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.expenses.list);
}

export async function createExpense(payload: any) {
  return apiService.post(ENDPOINTS.expenses.list, payload);
}

export async function expensesByYear(year: number) {
  return apiService.get(`${ENDPOINTS.expenses.list}/year/${year}`);
}

export default {
  formatCurrency,
  calculateTotal,
  calculateTotalByProperty,
  isValidAmount,
  listIncome,
  createIncome,
  incomeByYear,
  listExpenses,
  createExpense,
  expensesByYear
};
