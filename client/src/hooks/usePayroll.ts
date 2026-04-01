import { toast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePayrollRuns() {
  const qc = useQueryClient();

  const { data: runsResp } = useQuery<any>({
    queryKey: ['payroll-runs'],
    queryFn: () => apiService.get('/payroll')
  });

  const runs = runsResp?.data || [];

  const createRun = useMutation<any, Error, any>({
    mutationFn: (payload) => apiService.post('/payroll', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Success', description: 'Payroll run created' });
    }
  });

  const initializeRun = useMutation<any, Error, number>({
    mutationFn: (runId) => apiService.post(`/payroll/${runId}/initialize`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Success', description: 'Payroll run initialized' });
    }
  });

  const recordPayment = useMutation<any, Error, any>({
    mutationFn: ({ payrollItemId, payload }) =>
      apiService.post(`/payroll/${payrollItemId}/payment`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast({ title: 'Success', description: 'Payment recorded' });
    }
  });

  const generateReport = useMutation<any, Error, number>({
    mutationFn: (runId) => apiService.post(`/payroll/${runId}/report`, {}),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Report generated' });
    }
  });

  return { runs, createRun, initializeRun, recordPayment, generateReport };
}

export function usePayrollHistory(staffId: number) {
  const { data: historyResp } = useQuery<any>({
    queryKey: ['payroll-history', staffId],
    queryFn: () => apiService.get(`/payroll/staff/${staffId}/history`)
  });

  return historyResp?.data || [];
}
