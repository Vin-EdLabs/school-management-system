import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as settingsService from '../services/settingsService';

export function useActiveTerm() {
  return useQuery<any, Error, any>({
    queryKey: ['activeTerm'],
    queryFn: async () => {
      const res = await settingsService.getActiveTerm();
      return res.data || null;
    }
  });
}

export function useSetActiveTerm() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (id: number | string) => settingsService.setActiveTerm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['activeTerm'] });
      qc.invalidateQueries({ queryKey: ['academicTerms'] });
    }
  });
}

export function useActiveYear() {
  return useQuery<any, Error, any>({
    queryKey: ['settings', 'activeYear'],
    queryFn: async () => {
      const res = await settingsService.getActiveYear();
      return res.data || null;
    }
  });
}

export function useSetActiveYear() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: any) => settingsService.setActiveYear(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'activeYear'] }) });
}
