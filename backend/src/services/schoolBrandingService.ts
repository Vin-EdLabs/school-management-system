import { query } from '../db/connection.js';

type BrandingPatch = {
  name?: string | null;
  logo_url?: string | null;
};

/** Keep school_settings in sync when tenants branding changes (super-admin school edit). */
export async function syncSchoolSettingsFromTenant(
  tenantId: number,
  patch: BrandingPatch
): Promise<void> {
  const name = patch.name != null ? String(patch.name).trim() : null;
  const logoUrl = patch.logo_url != null ? String(patch.logo_url).trim() : null;
  if (!name && !logoUrl) return;

  await query(
    `INSERT INTO school_settings (tenant_id, school_name, logo_url)
     VALUES ($1, COALESCE($2, 'School'), $3)
     ON CONFLICT (tenant_id) DO UPDATE SET
       school_name = COALESCE($2, school_settings.school_name),
       logo_url = COALESCE($3, school_settings.logo_url),
       updated_at = CURRENT_TIMESTAMP`,
    [tenantId, name, logoUrl]
  );
}

/** Canonical display name — prefers tenants.name (updated by super-admin) over stale settings. */
export async function resolveSchoolDisplayName(tenantId: number): Promise<string> {
  const res = await query(
    `SELECT COALESCE(
       NULLIF(TRIM(t.name), ''),
       NULLIF(TRIM(ss.school_name), ''),
       'School'
     ) AS school_name
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId]
  );
  return res.rows[0]?.school_name || 'School';
}

/** If tenants and school_settings disagree, copy tenant branding into settings. */
export async function healSchoolBrandingMismatch(tenantId: number): Promise<void> {
  const res = await query(
    `SELECT
       t.name AS tenant_name,
       t.logo_url AS tenant_logo,
       ss.school_name AS settings_name,
       ss.logo_url AS settings_logo
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId]
  );
  const row = res.rows[0];
  if (!row) return;

  const tenantName = String(row.tenant_name || '').trim();
  const settingsName = String(row.settings_name || '').trim();
  const tenantLogo = row.tenant_logo ? String(row.tenant_logo) : null;
  const settingsLogo = row.settings_logo ? String(row.settings_logo) : null;

  const nameMismatch = tenantName && settingsName && tenantName !== settingsName;
  const logoMismatch = tenantLogo && tenantLogo !== settingsLogo;

  if (nameMismatch || logoMismatch) {
    await syncSchoolSettingsFromTenant(tenantId, {
      name: nameMismatch ? tenantName : null,
      logo_url: logoMismatch ? tenantLogo : null,
    });
  }
}
