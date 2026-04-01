import { toast } from '@/hooks/use-toast';
import * as feeStructuresService from '@/services/feeStructuresService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Hook for managing fee structures.
 * Uses TanStack Query's 'select' to normalize and deduplicate data efficiently.
 */
export function useFeeStructures() {
  const queryClient = useQueryClient();

  const { data: feeStructures = [], isLoading, error } = useQuery<any, Error, any[]>({
    queryKey: ['feeStructures'],
    queryFn: async () => {
      const resp = await feeStructuresService.listFeeStructures();
      return resp.data || resp || [];
    },
    select: (raw: any[]) => {
      // 1. Normalize backend shape
      const normalized = raw.map((f: any) => {
        const items = f.items || (typeof f.items === 'string' ? JSON.parse(f.items) : {});
        return {
          id: f.id,
          className: f.name || f.class_name || items.className || '',
          term: f.term || f.term_name || items.term || '',
          amount: Number(items.amount ?? f.amount ?? 0),
          description: items.description || f.description || '',
          dueDate: items.dueDate || f.dueDate || null,
          term_id: f.term_id,
          class_id: f.class_id,
          raw: f
        };
      });

      // 2. Deduplicate fee structures
      const map = new Map<string, any>();
      for (const fs of normalized) {
        const key = `${fs.className || ''}::${fs.term_id || ''}::${fs.amount || 0}::${fs.dueDate || ''}`;
        const existing = map.get(key);
        if (!existing) {
          map.set(key, fs);
          continue;
        }
        // prefer entry that has raw.class_id (class-specific) over level-wide
        const existingHasClass = existing.raw && existing.raw.class_id;
        const fsHasClass = fs.raw && fs.raw.class_id;
        if (fsHasClass && !existingHasClass) {
          map.set(key, fs);
        }
      }
      return Array.from(map.values());
    }
  });

  const createFeeStructure = useMutation<any, Error, any>({
    mutationFn: (payload: any) => feeStructuresService.createFeeStructure(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feeStructures'] });
      toast({ title: 'Fee structure created', description: 'New fee structure added.' });
    }
  });

  const updateFeeStructure = useMutation<any, Error, { id: number | string; payload: any }>({
    mutationFn: (variables: { id: number | string; payload: any }) =>
      feeStructuresService.updateFeeStructure(Number(variables.id), variables.payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['feeStructures'] });
      queryClient.invalidateQueries({ queryKey: ['feeStructure', Number(variables.id)] });
      toast({ title: 'Fee structure updated', description: 'Fee structure updated successfully.' });
    }
  });

  const deleteFeeStructure = useMutation<any, Error, number | string>({
    mutationFn: (id: number | string) => feeStructuresService.deleteFeeStructure(Number(id)),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ['feeStructures'] });
      queryClient.invalidateQueries({ queryKey: ['feeStructure', Number(id)] });
      toast({ title: 'Fee structure deleted', description: 'Fee structure removed.' });
    }
  });

  return {
    feeStructures,
    isLoading,
    error,
    createFeeStructure,
    updateFeeStructure,
    deleteFeeStructure
  };
}

/**
 * Hook for a specific fee structure.
 */
export function useFeeStructure(id: number | string) {
  return useQuery<any, Error, any>({
    queryKey: ['feeStructure', Number(id)],
    queryFn: () => feeStructuresService.getFeeStructure(Number(id)),
    enabled: !!id
  });
}

/**
 * Standardized create fee structure hook.
 */
/**
 * Standardized create fee structure hook.
 */
export function useCreateFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (payload: any) => feeStructuresService.createFeeStructure(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feeStructures'] });
      toast({ title: 'Fee structure created', description: 'New fee structure added.' });
    }
  });
}

export function useUpdateFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number | string; payload: any }>({
    mutationFn: ({ id, payload }) => feeStructuresService.updateFeeStructure(Number(id), payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['feeStructures'] });
      qc.invalidateQueries({ queryKey: ['feeStructure', Number(variables.id)] });
      toast({ title: 'Fee structure updated', description: 'Fee structure updated successfully.' });
    }
  });
}

export function useDeleteFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, number | string>({
    mutationFn: (id) => feeStructuresService.deleteFeeStructure(Number(id)),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['feeStructures'] });
      qc.invalidateQueries({ queryKey: ['feeStructure', Number(id)] });
      toast({ title: 'Fee structure deleted', description: 'Fee structure removed.' });
    }
  });
}

export default useFeeStructures;
