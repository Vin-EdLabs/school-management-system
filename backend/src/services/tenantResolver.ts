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
}

export async function resolveTenantById(id: number): Promise<TenantInfo | null> {
  const result = await query(
    `SELECT t.id, t.name, t.slug, t.subdomain,
            COALESCE(ss.logo_url, t.logo_url) AS logo_url,
            t.primary_color, t.secondary_color,
            COALESCE(t.subscription_status, 'active') as subscription_status,
            COALESCE(t.is_active, true) as is_active
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE t.id = $1`,
    [id]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function resolveTenantBySlug(slug: string): Promise<TenantInfo | null> {
  const result = await query(
    `SELECT t.id, t.name, t.slug, t.subdomain,
            COALESCE(ss.logo_url, t.logo_url) AS logo_url,
            t.primary_color, t.secondary_color,
            COALESCE(t.subscription_status, 'active') as subscription_status,
            COALESCE(t.is_active, true) as is_active
     FROM tenants t
     LEFT JOIN school_settings ss ON ss.tenant_id = t.id
     WHERE (LOWER(t.slug) = LOWER($1) OR LOWER(t.subdomain) = LOWER($1))
     AND COALESCE(t.is_active, true) = true`,
    [slug]
  );
  if (result.rows.length === 0) return null;
  return mapRow(result.rows[0]);
}

export async function resolveTenantBySubdomain(subdomain: string): Promise<TenantInfo | null> {
  return resolveTenantBySlug(subdomain);
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
  };
}
