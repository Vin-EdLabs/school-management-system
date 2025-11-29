import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as moneyService from '../services/services/moneyService';

export function useIncome(year?: number) {
  return useQuery(['income', year], () => (year ? moneyService.incomeByYear(year) : moneyService.listIncome()));
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation((payload: any) => moneyService.createIncome(payload), {
    onSuccess: () => qc.invalidateQueries(['income']),
  });
}

export function useExpenses(year?: number) {
  return useQuery(['expenses', year], () => (year ? moneyService.expensesByYear(year) : moneyService.listExpenses()));
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation((payload: any) => moneyService.createExpense(payload), {
    onSuccess: () => qc.invalidateQueries(['expenses']),
  });
}
