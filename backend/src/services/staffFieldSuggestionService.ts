import { query } from '../db/connection.js';

export type StaffFieldType = 'position' | 'department';

export async function listStaffFieldSuggestions(
  tenantId: number,
  fieldType: StaffFieldType
): Promise<string[]> {
  const res = await query(
    `SELECT name FROM staff_field_suggestions
     WHERE tenant_id = $1 AND field_type = $2
     ORDER BY LOWER(name) ASC`,
    [tenantId, fieldType]
  );
  return res.rows.map((row: { name: string }) => String(row.name));
}

export async function persistStaffFieldSuggestion(
  tenantId: number,
  fieldType: StaffFieldType,
  name: string | null | undefined
): Promise<void> {
  const trimmed = String(name || '').trim();
  if (!trimmed) return;
  await query(
    `INSERT INTO staff_field_suggestions (tenant_id, field_type, name)
     VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING`,
    [tenantId, fieldType, trimmed]
  ).catch(async () => {
    await query(
      `INSERT INTO staff_field_suggestions (tenant_id, field_type, name)
       SELECT $1, $2, $3
       WHERE NOT EXISTS (
         SELECT 1 FROM staff_field_suggestions
         WHERE tenant_id = $1 AND field_type = $2 AND LOWER(TRIM(name)) = LOWER(TRIM($3))
       )`,
      [tenantId, fieldType, trimmed]
    );
  });
}

export async function persistStaffProfileFields(
  tenantId: number,
  position?: string | null,
  department?: string | null
): Promise<void> {
  await Promise.all([
    persistStaffFieldSuggestion(tenantId, 'position', position),
    persistStaffFieldSuggestion(tenantId, 'department', department),
  ]);
}
