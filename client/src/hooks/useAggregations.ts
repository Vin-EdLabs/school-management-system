import { useQuery } from '@tanstack/react-query';
import * as aggService from '../services/services/aggregationsService';

export function useFeesByTerm(termId: number) {
  return useQuery(['agg','fees',termId], () => aggService.feesByTerm(termId));
}

export function useIncomeByYear(year: number) {
  return useQuery(['agg','income',year], () => aggService.incomeByYear(year));
}

export function useExpensesByYear(year: number) {
  return useQuery(['agg','expenses',year], () => aggService.expensesByYear(year));
}
