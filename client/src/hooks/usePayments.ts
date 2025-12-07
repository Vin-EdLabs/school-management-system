import { toast } from '@/hooks/use-toast';
import * as paymentsService from '@/services/paymentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePayments() {
  const queryClient = useQueryClient();
  const { data: paymentsResp } = useQuery<any, Error, any>({ queryKey: ['payments'], queryFn: paymentsService.listPayments });
  const payments = (paymentsResp as any)?.data || [];

  const createPayment = useMutation<any, Error, any>({
    mutationFn: (payload: any) => paymentsService.createPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Payment recorded', description: 'Payment successfully saved.' });
    }
  });

  const paymentsByStudent = async (studentId: number): Promise<any[]> => {
    const res = (await paymentsService.paymentsByStudent(studentId)) as any;
    return res?.data || [];
  };

  return {
    payments,
    createPayment,
    paymentsByStudent
  };
}

export default usePayments;
