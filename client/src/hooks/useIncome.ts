import { toast } from '@/hooks/use-toast';
import * as incomeService from '@/services/services/incomeService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useIncome() {
  const queryClient = useQueryClient();

  const { data: incomeResp } = useQuery(['income'], incomeService.listIncome);
  const income = incomeResp?.data || [];

  const createIncome = useMutation((payload: any) => incomeService.createIncome(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['income']);
      toast({ title: 'Income recorded', description: 'Income entry created successfully.' });
    }
  });

  return { income, createIncome };
}

export default useIncome;
