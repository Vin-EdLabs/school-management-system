import { useQuery } from '@tanstack/react-query';
import * as aggService from '../services/services/aggregationsService';

export function useFeesByTerm(termId: number) {
  return useQuery({
    queryKey: ['agg', 'fees', termId],
    queryFn: () => aggService.feesByTerm(termId),
  });
}

export function useIncomeByYear(year: number) {
  return useQuery({
    queryKey: ['agg', 'income', year],
    queryFn: () => aggService.incomeByYear(year),
  });
}

export function useExpensesByYear(year: number) {
  return useQuery({
    queryKey: ['agg', 'expenses', year],
    queryFn: () => aggService.expensesByYear(year),
  });
}
