import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import gradesService from '../services/gradesService';

export function useGradeBoundaries() {
  return useQuery({ queryKey: ['gradeBoundaries'], queryFn: () => gradesService.listBoundaries(), enabled: true });
}

export function useCreateBoundary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => gradesService.createBoundary(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gradeBoundaries'] })
  });
}

export function useUpdateBoundary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: any) => gradesService.updateBoundary(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gradeBoundaries'] })
  });
}

export function useDeleteBoundary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => gradesService.deleteBoundary(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gradeBoundaries'] })
  });
}

export default {
  useGradeBoundaries,
  useCreateBoundary,
  useUpdateBoundary,
  useDeleteBoundary
};
