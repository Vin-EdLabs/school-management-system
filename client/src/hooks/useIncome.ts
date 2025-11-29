import { toast } from '@/hooks/use-toast';
import * as incomeService from '@/services/services/incomeService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useIncome() {
  const queryClient = useQueryClient();
  const { data: incomeResp } = useQuery<any, Error, any>({ queryKey: ['income'], queryFn: incomeService.listIncome });
  const income = (incomeResp as any)?.data || [];

  const createIncome = useMutation<any, Error, any>({
    mutationFn: (payload: any) => incomeService.createIncome(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast({ title: 'Income recorded', description: 'Income entry created successfully.' });
    }
  });

  return { income, createIncome };
}

export default useIncome;
