import * as feeRepo from '../repositories/feeStructures.repository.js';

export async function createStructure(payload: any) {
  return feeRepo.createStructure(payload);
}

export async function getStructure(id: number) {
  return feeRepo.getStructureById(id);
}

export async function updateStructure(id: number, payload: any) {
  return feeRepo.updateStructure(id, payload);
}

export async function listStructures() {
  return feeRepo.listStructures();
}

export async function assignClass(id: number, classId: number) {
  return feeRepo.updateStructure(id, { class_id: classId });
}
