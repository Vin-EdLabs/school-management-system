import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '../services/services/settingsService';

export function useActiveTerm() {
  return useQuery(['settings','activeTerm'], () => settingsService.getActiveTerm());
}

export function useSetActiveTerm() {
  const qc = useQueryClient();
  return useMutation((payload:any) => settingsService.setActiveTerm(payload), { onSuccess: () => qc.invalidateQueries(['settings','activeTerm']) });
}

export function useActiveYear() {
  return useQuery(['settings','activeYear'], () => settingsService.getActiveYear());
}

export function useSetActiveYear() {
  const qc = useQueryClient();
  return useMutation((payload:any) => settingsService.setActiveYear(payload), { onSuccess: () => qc.invalidateQueries(['settings','activeYear']) });
}
