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

export function feeStructureCheckKey(ledgerTermId?: number | null) {
  return ['fee-structure-check', ledgerTermId ?? 'none'] as const;
}

export function useFeeStructureCheck(ledgerTermId?: number | null, enabled = true) {
  return useQuery({
    queryKey: feeStructureCheckKey(ledgerTermId),
    queryFn: async () => {
      const qs =
        ledgerTermId != null && !Number.isNaN(Number(ledgerTermId))
          ? `?term_id=${ledgerTermId}`
          : '';
      return apiService.get<FeeStructureCheckResult>(`/fees/structure-check${qs}`);
    },
    enabled: enabled && ledgerTermId != null,
    staleTime: 30 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });
}
