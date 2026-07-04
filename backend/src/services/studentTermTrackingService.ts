import { query } from '../db/connection.js';

export async function resolveAcademicTermId(
  tenantId: number,
  termName?: string,
  year?: string
): Promise<number | null> {
  const name = String(termName || '').trim();
  const yr = String(year || '').trim();
  if (!name || !yr) return null;

  const exact = await query(
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1 AND term_name = $2 AND year = $3
     LIMIT 1`,
    [tenantId, name, yr]
  );
  if (exact.rows.length > 0) return Number(exact.rows[0].id);

  const yearPrefix = yr.replace(/\D/g, '').slice(0, 4);
  const flexible = await query(
    `SELECT id FROM academic_terms
     WHERE tenant_id = $1
       AND LOWER(REGEXP_REPLACE(TRIM(term_name), '\\s+', ' ', 'g'))
         = LOWER(REGEXP_REPLACE(TRIM($2), '\\s+', ' ', 'g'))
       AND (
         TRIM(year) = TRIM($3)
         OR REPLACE(TRIM(year), ' ', '') = REPLACE(TRIM($3), ' ', '')
         OR ($4 <> '' AND TRIM(year) LIKE $4)
         OR TRIM($3) LIKE TRIM(year) || '%'
       )
     ORDER BY is_active DESC NULLS LAST, COALESCE(start_date, created_at) DESC NULLS LAST, id DESC
     LIMIT 1`,
    [tenantId, name, yr, yearPrefix ? `${yearPrefix}%` : yr]
  );
  const id = flexible.rows[0]?.id;
  return id != null ? Number(id) : null;
}

export async function getActiveAcademicTermId(tenantId: number): Promise<number | null> {
  try {
    const settingsRes = await query(
      `SELECT current_term, current_year FROM school_settings WHERE tenant_id = $1 LIMIT 1`,
      [tenantId]
    );
    const termName = String(settingsRes.rows[0]?.current_term || '').trim();
    const year = String(settingsRes.rows[0]?.current_year || '').trim();
    if (termName && year && termName !== 'Not Set') {
      const fromSettings = await resolveAcademicTermId(tenantId, termName, year);
      if (fromSettings != null) return fromSettings;
    }
  } catch {
    // school_settings may be unavailable on legacy schemas
  }

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
