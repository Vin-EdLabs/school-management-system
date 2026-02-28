import * as feeStructuresService from '@/services/feeStructuresService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export function useFeeStructures() {
  const { data: feeStructuresResp } = useQuery<any, Error, any>({ queryKey: ['feeStructures'], queryFn: feeStructuresService.listFeeStructures });
  const raw = (feeStructuresResp as any)?.data || [];
  // Normalize backend shape: backend stores `name` and `items` JSON
  const feeStructures = (raw || []).map((f: any) => {
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
  // Deduplicate fee structures displayed in the UI: prefer class-specific entries but collapse identical level entries
  const deduped = (() => {
    const map = new Map<string, any>();
    for (const fs of feeStructures) {
      const key = `${fs.className || ''}::${fs.term_id || ''}::${fs.amount || 0}::${fs.dueDate || ''}`;
      // If we already have a class-specific entry for same key, keep it; otherwise set first seen
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
  })();

  return {
    feeStructures: deduped
  };
}

export default useFeeStructures;

// Query-only hook (named differently to avoid duplicate export name)
export function useFeeStructuresQuery() {
  return useQuery<any, Error, any>({ queryKey: ['feeStructures'], queryFn: () => feeStructuresService.listFeeStructures() });
}

export function useCreateFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: any) => feeStructuresService.createFeeStructure(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['feeStructures'] }) });
}

export function useFeeStructure(id: number) {
  return useQuery<any, Error, any>({ queryKey: ['feeStructure', id], queryFn: () => feeStructuresService.getFeeStructure(id) });
}

export function useUpdateFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, { id: number; payload: any }>({
    mutationFn: ({ id, payload }) => feeStructuresService.updateFeeStructure(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feeStructures'] })
  });
}

export function useDeleteFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, number>({
    mutationFn: (id) => feeStructuresService.deleteFeeStructure(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feeStructures'] })
  });
}
