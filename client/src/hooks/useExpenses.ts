import { toast } from '@/hooks/use-toast';
import * as expensesService from '@/services/services/expensesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useExpenses() {
  const qc = useQueryClient();
  const { data: expensesResp } = useQuery(['expenses'], expensesService.listExpenses);
  const expenses = expensesResp?.data || [];

  const createExpense = useMutation((payload: any) => expensesService.createExpense(payload), {
    onSuccess: () => {
      qc.invalidateQueries(['expenses']);
      toast({ title: 'Expense recorded', description: 'Expense entry created.' });
    }
  });

  return { expenses, createExpense };
}

export default useExpenses;