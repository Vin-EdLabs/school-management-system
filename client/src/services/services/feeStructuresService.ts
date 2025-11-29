import type { FeeStructure } from '../../types/feeStructure';
import { apiService } from '../api';
import ENDPOINTS from '../endpoints';

export async function listFeeStructures(): Promise<{ data: FeeStructure[] }> {
  return apiService.get(ENDPOINTS.feeStructures);
}

export async function createFeeStructure(payload: Partial<FeeStructure>) {
  return apiService.post(ENDPOINTS.feeStructures, payload);
}

export async function getFeeStructure(id: number) {
  return apiService.get(`${ENDPOINTS.feeStructures}/${id}`);
}

export async function assignClassToFee(id: number, classId: number) {
  return apiService.post(`${ENDPOINTS.feeStructures}/${id}/assign-class`, { class_id: classId });
}

export async function assignTermToFee(id: number, termId: number) {
  return apiService.post(`${ENDPOINTS.feeStructures}/${id}/assign-term`, { term_id: termId });
}

export default { listFeeStructures, createFeeStructure, getFeeStructure, assignClassToFee, assignTermToFee };
