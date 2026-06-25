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

/** Stable key — check always uses school_settings (same source as saving fees). */
export const FEE_STRUCTURE_CHECK_KEY = ['fee-structure-check', 'active'] as const;

export function feeStructureCheckKey(_termId?: number | null) {
  return FEE_STRUCTURE_CHECK_KEY;
}

export function useFeeStructureCheck(_termId?: number | null, enabled = true) {
  return useQuery({
    queryKey: FEE_STRUCTURE_CHECK_KEY,
    queryFn: async () => apiService.get<FeeStructureCheckResult>('/fees/structure-check'),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
