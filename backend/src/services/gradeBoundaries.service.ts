import * as repo from '../repositories/gradeBoundaries.repository.js';

function overlaps(aMin: number, aMax: number, bMin: number, bMax: number) {
  return aMin <= bMax && aMax >= bMin;
}

export async function listGradeBoundaries(filter: any = {}) {
  return repo.listGradeBoundaries(filter);
}

export async function createGradeBoundary(payload: any) {
  const min = Number(payload.min);
  const max = Number(payload.max);
  if (Number.isNaN(min) || Number.isNaN(max)) throw { status: 400, message: 'Invalid min or max' };
  if (min > max) throw { status: 400, message: 'min must be <= max' };

  // check overlaps for same school/class
  // only consider global boundaries (class_id IS NULL)
  const existing = await repo.listGradeBoundaries({ schoolId: payload.school_id ?? null });
  for (const ex of existing) {
    if (overlaps(min, max, Number(ex.min), Number(ex.max))) {
      throw { status: 400, message: `Overlaps with existing boundary '${ex.grade}' (${ex.min}-${ex.max})` };
    }
  }

  // enforce class_id null for global boundaries
  const upayload = { ...payload, class_id: null };
  return repo.createGradeBoundary(upayload);
}

export async function updateGradeBoundary(id: number, patch: any) {
  const min = patch.min !== undefined ? Number(patch.min) : undefined;
  const max = patch.max !== undefined ? Number(patch.max) : undefined;
  if ((min !== undefined && Number.isNaN(min)) || (max !== undefined && Number.isNaN(max))) throw { status: 400, message: 'Invalid min or max' };
  if (min !== undefined && max !== undefined && min > max) throw { status: 400, message: 'min must be <= max' };

  // load existing boundaries for same scope
  const scope = { schoolId: patch.school_id ?? null };
  const existing = await repo.listGradeBoundaries(scope);
  for (const ex of existing) {
    if (Number(ex.id) === Number(id)) continue;
    const exMin = Number(ex.min);
    const exMax = Number(ex.max);
    const newMin = min !== undefined ? min : exMin;
    const newMax = max !== undefined ? max : exMax;
    if (overlaps(newMin, newMax, exMin, exMax)) {
      throw { status: 400, message: `Overlaps with existing boundary '${ex.grade}' (${ex.min}-${ex.max})` };
    }
  }

  // Prevent setting class_id on update; keep boundaries global
  const upatch = { ...patch };
  if (upatch.class_id !== undefined) upatch.class_id = null;
  return repo.updateGradeBoundary(id, upatch);
}

export async function deleteGradeBoundary(id: number) {
  return repo.deleteGradeBoundary(id);
}

export default {
  listGradeBoundaries,
  createGradeBoundary,
  updateGradeBoundary,
  deleteGradeBoundary
};
