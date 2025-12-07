import { toast } from '@/hooks/use-toast';
import * as expensesService from '@/services/expensesService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useExpenses() {
  const qc = useQueryClient();
  const { data: expensesResp } = useQuery<any, Error, any>({ queryKey: ['expenses'], queryFn: expensesService.listExpenses });
  const expenses = (expensesResp as any)?.data || [];

  const createExpense = useMutation<any, Error, any>({
    mutationFn: (payload: any) => expensesService.createExpense(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense recorded', description: 'Expense entry created.' });
    }
  });

  return { expenses, createExpense };
}

export default useExpenses;