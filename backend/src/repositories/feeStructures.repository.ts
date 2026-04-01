import { query } from '../config/db.js';

export async function createStructure(payload: { name: string; items?: any; term_id?: number; class_id?: number }) {
  const res = await query('INSERT INTO fee_structures (name, items, term_id, class_id) VALUES ($1, $2, $3, $4) RETURNING *', [payload.name, JSON.stringify(payload.items ?? {}), payload.term_id ?? null, payload.class_id ?? null]);
  return res.rows[0];
}

export async function getStructureById(id: number) {
  const res = await query('SELECT * FROM fee_structures WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0];
}

export async function updateStructure(id: number, payload: any) {
  await query('UPDATE fee_structures SET items = $1, name = $2, term_id = $3, class_id = $4 WHERE id = $5', [JSON.stringify(payload.items ?? {}), payload.name, payload.term_id ?? null, payload.class_id ?? null, id]);
  return getStructureById(id);
}

export async function listStructures() {
  const res = await query('SELECT * FROM fee_structures ORDER BY created_at DESC');
  return res.rows;
} export async function deleteStructure(id: number) {
  await query('DELETE FROM fee_structures WHERE id = $1', [id]);
  return true;
}
