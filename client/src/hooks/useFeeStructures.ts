import * as feeStructuresService from '@/services/services/feeStructuresService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as feeService from '../services/services/feeStructuresService';

export function useFeeStructures() {
  const { data: feeStructuresResp } = useQuery(['feeStructures'], feeStructuresService.listFeeStructures);
  const feeStructures = feeStructuresResp?.data || [];

  return {
    feeStructures
  };
}

export default useFeeStructures;

export function useFeeStructures() {
  return useQuery(['feeStructures'], () => feeService.listFeeStructures());
}

export function useCreateFeeStructure() {
  const qc = useQueryClient();
  return useMutation((payload: any) => feeService.createFeeStructure(payload), {
    onSuccess: () => qc.invalidateQueries(['feeStructures']),
  });
}

export function useFeeStructure(id: number) {
  return useQuery(['feeStructure', id], () => feeService.getFeeStructure(id));
}
