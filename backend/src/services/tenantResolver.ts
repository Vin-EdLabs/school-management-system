/**
 * Tenant Resolver Service
 * Resolves tenant/school from subdomain, path, header, or query
 */
import { query } from '../db/connection.js';

export interface TenantInfo {
  id: number;
  name: string;
  slug: string | null;
  subdomain: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  subscription_status: string;
  is_active: boolean;
  archived_at?: string | null;
}

const ACTIVE_TENANT_FILTER = `COALESCE(is_active, true) = true AND archived_at IS NULL`;

export async function resolveTenantById(id: number): Promise<TenantInfo | null> {
  const result = await query(
    `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color, 
            COALESCE(subscription_status, 'active') as subscription_status,
            COALESCE(is_active, true) as is_active,
            archived_at
     FROM tenants WHERE id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function resolveTenantBySlug(slug: string): Promise<TenantInfo | null> {
  const result = await query(
    `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
            COALESCE(subscription_status, 'active') as subscription_status,
            COALESCE(is_active, true) as is_active,
            archived_at
     FROM tenants 
     WHERE (LOWER(slug) = LOWER($1) OR LOWER(subdomain) = LOWER($1)) 
     AND ${ACTIVE_TENANT_FILTER}`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

/** Includes deactivated schools — for public portal pages to show the correct message. */
export async function resolveTenantBySlugAnyStatus(slug: string): Promise<TenantInfo | null> {
  const result = await query(
    `SELECT id, name, slug, subdomain, logo_url, primary_color, secondary_color,
            COALESCE(subscription_status, 'active') as subscription_status,
            COALESCE(is_active, true) as is_active,
            archived_at
     FROM tenants 
     WHERE LOWER(slug) = LOWER($1) OR LOWER(subdomain) = LOWER($1)`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function resolveTenantBySubdomain(subdomain: string): Promise<TenantInfo | null> {
  return resolveTenantBySlug(subdomain);
}

/** Resolve tenant from public school website subdomain ({name}.edu.scholarnerve.com). */
export async function resolveTenantByWebsiteSubdomain(subdomain: string): Promise<TenantInfo | null> {
  const key = String(subdomain || '').trim().toLowerCase();
  if (!key) return null;

  const result = await query(
    `SELECT t.id, t.name, t.slug, t.subdomain, t.logo_url, t.primary_color, t.secondary_color,
            COALESCE(t.subscription_status, 'active') as subscription_status,
            COALESCE(t.is_active, true) as is_active,
            t.archived_at
     FROM tenants t
     LEFT JOIN school_websites sw ON sw.tenant_id = t.id
     WHERE ${ACTIVE_TENANT_FILTER}
       AND (
         LOWER(COALESCE(NULLIF(TRIM(sw.public_subdomain), ''), t.slug)) = LOWER($1)
         OR LOWER(t.slug) = LOWER($1)
         OR LOWER(t.subdomain) = LOWER($1)
       )
     LIMIT 1`,
    [key]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

function mapRow(row: any): TenantInfo {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    subdomain: row.subdomain,
    logo_url: row.logo_url,
    primary_color: row.primary_color,
    secondary_color: row.secondary_color,
    subscription_status: row.subscription_status || 'active',
    is_active: row.is_active !== false,
    archived_at: row.archived_at ?? null,
  };
}

export function isTenantArchived(tenant: TenantInfo | null | undefined): boolean {
  return !!tenant?.archived_at;
}
