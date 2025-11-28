import * as expensesRepo from '../repositories/expenses.repository.js';

export async function createExpense(payload: any) {
  return expensesRepo.createExpense(payload);
}

export async function updateExpense(id: number, payload: any) {
  return expensesRepo.updateExpense(id, payload);
}

export async function deleteExpense(id: number) {
  return expensesRepo.deleteExpense(id);
}

export async function listExpensesForYear(year: number) {
  return expensesRepo.listExpensesByYear(year);
}

export async function listExpenseCategories() {
  return expensesRepo.listCategories();
}
