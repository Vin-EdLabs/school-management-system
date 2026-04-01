import * as feeRepo from '../repositories/feeStructures.repository.js';
import * as settingsService from './settings.service.js';

export async function createStructure(payload: any) {
  if (!payload.term_id) {
    const activeTerm = await settingsService.getActiveTerm();
    if (activeTerm) {
      payload.term_id = activeTerm.id;
    }
  }
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

// Duplicate any fee structures defined at the level (no class_id) to the given class
export async function applyLevelFeesToClass(levelName: string, classId: number) {
  const all = await feeRepo.listStructures();
  const matches = (all || []).filter((f: any) => (f.class_id === null || f.class_id === undefined) && String(f.name).trim() === String(levelName).trim());
  const created: any[] = [];
  for (const m of matches) {
    try {
      // skip if a per-class fee already exists for this level + term
      const exists = (all || []).some((f: any) => (f.class_id === classId) && String(f.name).trim() === String(m.name).trim() && ((f.term_id ?? null) === (m.term_id ?? null)));
      if (exists) continue;
      const payload = { name: m.name, items: m.items ?? {}, term_id: m.term_id ?? null, class_id: classId };
      const c = await feeRepo.createStructure(payload);
      created.push(c);
    } catch (e) {
      // ignore individual failures
    }
  }
  return created;
}

export async function deleteStructure(id: number) {
  return feeRepo.deleteStructure(id);
}
