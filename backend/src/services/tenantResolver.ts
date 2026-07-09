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
