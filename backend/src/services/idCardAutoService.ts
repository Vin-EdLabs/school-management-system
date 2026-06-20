import { query } from '../db/connection.js';

/** Ensure an ACTIVE generated_id_cards row exists (empty card_data — live template on render). */
export async function ensureGeneratedIdCard(opts: {
  tenantId: number;
  entityType: 'STUDENT' | 'STAFF';
  entityId: number;
  generatedAt?: Date | string | null;
  generatedBy?: number | null;
}): Promise<number> {
  const { tenantId, entityType, entityId, generatedAt, generatedBy = null } = opts;

  const active = await query(
    `SELECT id FROM generated_id_cards
     WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3 AND status = 'ACTIVE'
     LIMIT 1`,
    [tenantId, entityType, entityId]
  );
  if (active.rows[0]) return Number(active.rows[0].id);

  const at = generatedAt ? new Date(generatedAt) : new Date();
  const inserted = await query(
    `INSERT INTO generated_id_cards (tenant_id, entity_type, entity_id, card_data, generated_by, generated_at, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING id`,
    [tenantId, entityType, entityId, JSON.stringify({}), generatedBy, at]
  );
  return Number(inserted.rows[0].id);
}
