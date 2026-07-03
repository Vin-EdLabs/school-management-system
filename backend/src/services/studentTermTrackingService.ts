import { query } from '../db/connection.js';

export async function getActiveAcademicTermId(tenantId: number): Promise<number | null> {
  const sqlVariants = [
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1
       AND is_active = true
       AND COALESCE(is_archived, false) = false
     ORDER BY COALESCE(start_date, created_at) DESC NULLS LAST, id DESC
     LIMIT 1`,
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY COALESCE(start_date, created_at) DESC NULLS LAST, id DESC
     LIMIT 1`,
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY id DESC
     LIMIT 1`,
  ];

  for (const sql of sqlVariants) {
    try {
      const result = await query(sql, [tenantId]);
      const id = result.rows[0]?.id;
      if (id != null) return Number(id);
    } catch {
      // Try simpler query when optional columns are missing.
    }
  }
  return null;
}

export async function resolveAcademicTermId(
  tenantId: number,
  termName?: string,
  year?: string
): Promise<number | null> {
  const name = String(termName || '').trim();
  const yr = String(year || '').trim();
  if (!name || !yr) return null;
  const result = await query(
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1 AND term_name = $2 AND year = $3
     LIMIT 1`,
    [tenantId, name, yr]
  );
  const id = result.rows[0]?.id;
  return id != null ? Number(id) : null;
}
