import * as feeStructuresService from '@/services/services/feeStructuresService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as feeService from '../services/services/feeStructuresService';

export function useFeeStructures() {
  const { data: feeStructuresResp } = useQuery<any, Error, any>({ queryKey: ['feeStructures'], queryFn: feeStructuresService.listFeeStructures });
  const feeStructures = (feeStructuresResp as any)?.data || [];

  return {
    feeStructures
  };
}

export default useFeeStructures;

// Query-only hook (named differently to avoid duplicate export name)
export function useFeeStructuresQuery() {
  return useQuery<any, Error, any>({ queryKey: ['feeStructures'], queryFn: () => feeService.listFeeStructures() });
}

export function useCreateFeeStructure() {
  const qc = useQueryClient();
  return useMutation<any, Error, any>({ mutationFn: (payload: any) => feeService.createFeeStructure(payload), onSuccess: () => qc.invalidateQueries({ queryKey: ['feeStructures'] }) });
}

export function useFeeStructure(id: number) {
  return useQuery<any, Error, any>({ queryKey: ['feeStructure', id], queryFn: () => feeService.getFeeStructure(id) });
}
