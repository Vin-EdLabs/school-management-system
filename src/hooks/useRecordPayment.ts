import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useData, type Payment } from '../contexts/DataContext';
import { toast } from '@/hooks/use-toast';

export const financeQueryKeys = {
  payments: (studentId: string) => ['payments', studentId] as const,
  ledger: (studentId: string) => ['ledger', studentId] as const,
  student: (studentId: string) => ['student', studentId] as const,
};

export type RecordPaymentInput = {
  studentId: string;
  studentIdNum?: number;
  amount: number;
  date: string;
  paymentMethod: string;
  term: string;
  notes: string;
  academicYear?: string;
};

type PaymentApiResponse = {
  payment?: {
    id: number;
    receipt_number: string;
    student_id: number;
    amount: number;
    payment_date: string;
    payment_method: string;
    term: string;
    notes: string;
    receipt_snapshot?: Payment['receiptSnapshot'];
  };
  balance?: {
    totalFees: number;
    totalPaid: number;
    outstanding: number;
    arrears: number;
    credit: number;
    status: string;
  };
  id?: number;
  receipt_number?: string;
  student_id?: number;
  amount?: number;
  payment_date?: string;
  payment_method?: string;
  term?: string;
  notes?: string;
  receipt_snapshot?: Payment['receiptSnapshot'];
};

function mapApiPayment(created: PaymentApiResponse['payment'] & PaymentApiResponse, studentId: string): Payment {
  const row = (created.payment || created) as PaymentApiResponse['payment'] & PaymentApiResponse;
  return {
    id: String(row.id),
    studentId: String(row.student_id ?? studentId),
    studentIdNum: row.student_id,
    amount: parseFloat(String(row.amount ?? 0)),
    date: (row.payment_date || '').split('T')[0],
    paymentMethod: row.payment_method || '',
    term: row.term ?? '',
    notes: row.notes ?? '',
    receiptNumber: row.receipt_number,
    receiptSnapshot: row.receipt_snapshot,
  };
}

function buildOptimisticPayment(input: RecordPaymentInput): Payment {
  return {
    id: `optimistic-${Date.now()}`,
    studentId: input.studentId,
    studentIdNum: input.studentIdNum ?? parseInt(input.studentId, 10),
    amount: input.amount,
    date: input.date,
    paymentMethod: input.paymentMethod,
    term: input.term,
    notes: input.notes,
    receiptNumber: `PENDING-${Date.now().toString().slice(-6)}`,
  };
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { applyPaymentLocally, revertPaymentLocally } = useData();

  return useMutation({
    mutationFn: async (input: RecordPaymentInput) => {
      const res = await apiService.post<PaymentApiResponse>('/payments', {
        student_id: input.studentIdNum || parseInt(input.studentId, 10),
        amount: input.amount,
        payment_date: input.date,
        payment_method: input.paymentMethod,
        term: input.term,
        notes: input.notes,
        academic_year: input.academicYear,
      });
      return { res, input };
    },
    onMutate: async (input) => {
      const studentId = input.studentId;
      await queryClient.cancelQueries({ queryKey: financeQueryKeys.payments(studentId) });
      await queryClient.cancelQueries({ queryKey: financeQueryKeys.ledger(studentId) });
      await queryClient.cancelQueries({ queryKey: financeQueryKeys.student(studentId) });

      const previousPayments = queryClient.getQueryData<Payment[]>(financeQueryKeys.payments(studentId));
      const optimistic = buildOptimisticPayment(input);

      queryClient.setQueryData<Payment[]>(financeQueryKeys.payments(studentId), (old) => [
        optimistic,
        ...(old || []),
      ]);

      const rollbackToken = applyPaymentLocally(optimistic, input.amount);

      return { previousPayments, studentId, optimisticId: optimistic.id, rollbackToken };
    },
    onError: (error: Error, input, context) => {
      if (context?.previousPayments) {
        queryClient.setQueryData(financeQueryKeys.payments(context.studentId), context.previousPayments);
      }
      if (context?.rollbackToken) {
        revertPaymentLocally(context.rollbackToken);
      }
      toast({
        title: 'Payment failed',
        description: error?.message || 'Could not record payment',
        variant: 'destructive',
      });
    },
    onSuccess: ({ res, input }) => {
      const payment = mapApiPayment(res.payment || res, input.studentId);
      queryClient.setQueryData<Payment[]>(financeQueryKeys.payments(input.studentId), (old) => {
        const list = old || [];
        const withoutOptimistic = list.filter((p) => !p.id.startsWith('optimistic-'));
        return [payment, ...withoutOptimistic.filter((p) => p.id !== payment.id)];
      });

      applyPaymentLocally(payment, input.amount, res.balance);

      toast({
        title: 'Payment Recorded',
        description: `GHS ${input.amount.toFixed(2)} recorded successfully`,
      });
    },
    onSettled: (_data, _error, input) => {
      const studentId = input.studentId;
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.payments(studentId) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.ledger(studentId) });
      queryClient.invalidateQueries({ queryKey: financeQueryKeys.student(studentId) });
    },
  });
}
