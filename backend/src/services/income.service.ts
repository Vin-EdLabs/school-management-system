import * as incomeRepo from '../repositories/income.repository.js';

export async function createIncome(payload: any) {
  return incomeRepo.createIncome(payload);
}

export async function updateIncome(id: number, payload: any) {
  return incomeRepo.updateIncome(id, payload);
}

export async function deleteIncome(id: number) {
  return incomeRepo.deleteIncome(id);
}

export async function listIncomeForYear(year: number) {
  return incomeRepo.listIncomeByYear(year);
}
