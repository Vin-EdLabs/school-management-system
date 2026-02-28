import { toast } from '@/hooks/use-toast';
import * as paymentsService from '@/services/paymentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for managing school payments.
 */
export function usePayments() {
  const queryClient = useQueryClient();

  // 1. Fetch all payments
  const { data: paymentsResp, isLoading, error } = useQuery<any, Error, any>({
    queryKey: ['payments'],
    queryFn: paymentsService.listPayments
  });

  const payments = (paymentsResp as any)?.data || [];

  // 2. Create payment mutation
  const createPayment = useMutation<any, Error, any>({
    mutationFn: (payload: any) => paymentsService.createPayment(payload),
    onSuccess: (_data, variables) => {
      // Invalidate all payments
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // Invalidate specific student's payments
      if (variables.student_id || variables.studentId) {
        queryClient.invalidateQueries({
          queryKey: ['payments', 'student', Number(variables.student_id || variables.studentId)]
        });
      }
      // Also invalidate students query as it often contains balance info
      queryClient.invalidateQueries({ queryKey: ['students'] });

      toast({ title: 'Payment recorded', description: 'Payment successfully saved.' });
    }
  });

  return {
    payments,
    isLoading,
    error,
    createPayment
  };
}

/**
 * Hook for fetching payments for a specific student.
 */
export function useStudentPayments(studentId: number | string) {
  return useQuery<any, Error, any[]>({
    queryKey: ['payments', 'student', Number(studentId)],
    queryFn: async () => {
      const res = await paymentsService.paymentsByStudent(Number(studentId));
      return (res as any)?.data || [];
    },
    enabled: !!studentId
  });
}

/**
 * Standalone create payment hook.
 */
export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (payload: any) => paymentsService.createPayment(payload),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['payments'] });
      qc.invalidateQueries({ queryKey: ['payments', 'student', Number(vars.student_id || vars.studentId)] });
      qc.invalidateQueries({ queryKey: ['students'] });
      toast({ title: 'Payment recorded', description: 'Payment successfully saved.' });
    }
  });
}

export default usePayments;
