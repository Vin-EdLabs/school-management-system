import { useQuery } from '@tanstack/react-query';
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
