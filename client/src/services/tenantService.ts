/**
 * Tenant service - fetches tenant/school info for branding
 * Uses public API - no auth required
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const API_ORIGIN = API_BASE.replace(/\/api.*$/, '');

export interface TenantBranding {
  id: number;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

export function resolveLogoUrl(logoUrl: string | null): string | null {
  if (!logoUrl) return null;
  if (logoUrl.startsWith('http')) return logoUrl;
  return `${API_ORIGIN}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
}

export async function fetchTenantById(id: number): Promise<TenantBranding | null> {
  try {
    const res = await fetch(`${API_BASE}/tenant/by-id/${id}`);
    const data = await res.json();
    return data?.tenant ?? null;
  } catch {
    return null;
  }
}

export async function fetchTenantBySlug(slug: string): Promise<TenantBranding | null> {
  try {
    const res = await fetch(`${API_BASE}/tenant/by-slug/${slug}`);
    const data = await res.json();
    return data?.tenant ?? null;
  } catch {
    return null;
  }
}
