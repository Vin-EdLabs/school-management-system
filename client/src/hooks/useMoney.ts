import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as moneyService from '../services/moneyService';

export function useIncome(year?: number) {
  return useQuery<any, Error, any>({ queryKey: ['income', year], queryFn: () => (year ? moneyService.incomeByYear(year) : moneyService.listIncome()) });
}

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: any) => moneyService.createIncome(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['income'] }) });
}

export function useExpenses(year?: number) {
  return useQuery<any, Error, any>({ queryKey: ['expenses', year], queryFn: () => (year ? moneyService.expensesByYear(year) : moneyService.listExpenses()) });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: any) => moneyService.createExpense(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }) });
}
