import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '../services/settingsService';

export function useActiveTerm() {
  return useQuery<any, Error, any>({ queryKey: ['settings','activeTerm'], queryFn: () => settingsService.getActiveTerm() });
}

export function useSetActiveTerm() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload:any) => settingsService.setActiveTerm(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings','activeTerm'] }) });
}

export function useActiveYear() {
  return useQuery<any, Error, any>({ queryKey: ['settings','activeYear'], queryFn: () => settingsService.getActiveYear() });
}

export function useSetActiveYear() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload:any) => settingsService.setActiveYear(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings','activeYear'] }) });
}
