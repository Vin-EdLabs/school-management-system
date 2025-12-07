import * as payrollService from '@/services/payrollService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['payroll', 'runs'],
    queryFn: async () => {
      const res = await payrollService.listPayrollRuns();
      return (res as any)?.data || [];
    },
  });
}

export function useInitializeRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (runId: number) => payrollService.initializePayroll(runId.toString()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useCreatePayrollRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { monthYear: string }) => payrollService.createPayrollRun(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll', 'runs'] });
      qc.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (runId: number) => payrollService.generateReport(runId.toString()),
  });
}

export function usePayrollRunDetails(runId?: number) {
  return useQuery({
    queryKey: ['payroll', 'run', runId],
    enabled: !!runId,
    queryFn: async () => {
      if (!runId) return null;
      const res = await payrollService.getPayrollRun(runId.toString());
      return (res as any)?.data || null;
    },
  });
}
