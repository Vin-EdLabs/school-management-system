import { query } from '../config/db.js';

export async function listGradeBoundaries(filter: { schoolId?: number | null } = {}) {
  // Grade boundaries are global (school-wide). Ignore class-specific filters.
  const params: any[] = [];
  const where: string[] = [`class_id IS NULL`];
  if (filter.schoolId !== undefined) { params.push(filter.schoolId); where.push(`school_id = $${params.length}`); }
  let sql = `SELECT * FROM grade_boundaries`;
  if (where.length) sql += ` WHERE ` + where.join(' AND ');
  sql += ` ORDER BY id ASC`;
  const res = await query(sql, params);
  return res.rows;
}

export async function createGradeBoundary(payload: { grade: string; min: number; max: number; school_id?: number | null; class_id?: number | null; created_by?: number | null }) {
  const res = await query(
    `INSERT INTO grade_boundaries (grade, min, max, school_id, class_id, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [payload.grade, payload.min, payload.max, payload.school_id || null, payload.class_id || null, payload.created_by || null]
  );
  return res.rows[0];
}

export async function updateGradeBoundary(id: number, patch: any) {
  const fields: string[] = [];
  const params: any[] = [];
  let idx = 1;
  for (const key of ['grade', 'min', 'max', 'school_id', 'class_id']) {
    if (patch[key] !== undefined) { fields.push(`${key} = $${idx++}`); params.push(patch[key]); }
  }
  if (fields.length === 0) return null;
  params.push(id);
  const sql = `UPDATE grade_boundaries SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`;
  const res = await query(sql, params);
  return res.rows[0];
}

export async function deleteGradeBoundary(id: number) {
  await query(`DELETE FROM grade_boundaries WHERE id = $1`, [id]);
  return { deleted: true };
}

export default {
  listGradeBoundaries,
  createGradeBoundary,
  updateGradeBoundary,
  deleteGradeBoundary
};
