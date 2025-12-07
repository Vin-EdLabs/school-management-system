import { apiService } from './api';
import ENDPOINTS from './endpoints';

export async function listFeeStructures(): Promise<{ data: any[] }> {
  return apiService.get(ENDPOINTS.feeStructures.list);
}

export async function createFeeStructure(payload: any): Promise<{ data: any }> {
  return apiService.post(ENDPOINTS.feeStructures.create, payload);
}

export async function getFeeStructure(id: string | number): Promise<{ data: any }> {
  return apiService.get(ENDPOINTS.feeStructures.get(id.toString()));
}

export default { listFeeStructures, createFeeStructure, getFeeStructure };
