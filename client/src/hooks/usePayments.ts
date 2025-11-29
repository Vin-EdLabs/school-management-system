import { toast } from '@/hooks/use-toast';
import * as paymentsService from '@/services/services/paymentsService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePayments() {
  const queryClient = useQueryClient();

  const { data: paymentsResp } = useQuery(['payments'], paymentsService.listPayments);
  const payments = paymentsResp?.data || [];

  const createPayment = useMutation((payload: any) => paymentsService.createPayment(payload), {
    onSuccess: () => {
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['students']);
      toast({ title: 'Payment recorded', description: 'Payment successfully saved.' });
    }
  });

  const paymentsByStudent = async (studentId: number) => {
    const res = await paymentsService.paymentsByStudent(studentId);
    return res?.data || [];
  };

  return {
    payments,
    createPayment,
    paymentsByStudent
  };
}

export default usePayments;

export function usePayments() {
  return useQuery(['payments'], () => paymentsService.listPayments());
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation((payload: any) => paymentsService.createPayment(payload), {
    onSuccess: () => qc.invalidateQueries(['payments']),
  });
}

export function usePayment(id: number) {
  return useQuery(['payment', id], () => paymentsService.getPayment(id));
}

export function usePaymentsByStudent(studentId: number) {
  return useQuery(['payments', 'student', studentId], () => paymentsService.paymentsByStudent(studentId));
}
