import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as auditService from '../services/auditService';

export function useLoginAudits() {
  return useQuery({
    queryKey: ['audit', 'logins'],
    queryFn: () => auditService.listLoginAudits(),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ['audit', 'activity'],
    queryFn: () => auditService.listActivity(),
  });
}

export function useDeleteAuditLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string | number) => auditService.deleteAuditLog(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
    }
  });
}

export function useClearAuditLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => auditService.clearAllLogs(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['audit'] });
    }
  });
}
