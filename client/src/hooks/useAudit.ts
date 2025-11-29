import { useQuery } from '@tanstack/react-query';
import * as auditService from '../services/services/auditService';

export function useLoginAudits() {
  return useQuery(['audit','logins'], () => auditService.listLoginAudits());
}

export function useActivity() {
  return useQuery(['audit','activity'], () => auditService.listActivity());
}
