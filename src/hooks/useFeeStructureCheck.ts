import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';

export type MissingClass = { id: string; name: string };

export type FeeStructureCheckResult = {
  complete: boolean;
  total_classes: number;
  configured_classes: number;
  missing_classes: MissingClass[];
  term_id: number | null;
};

export function feeStructureCheckKey(termId: number | null | undefined) {
  return ['fee-structure-check', termId ?? 'active'] as const;
}

export function useFeeStructureCheck(termId: number | null | undefined, enabled = true) {
  return useQuery({
    queryKey: feeStructureCheckKey(termId),
    queryFn: async () => {
      const query = termId != null ? `?term_id=${termId}` : '';
      return apiService.get<FeeStructureCheckResult>(`/fees/structure-check${query}`);
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
