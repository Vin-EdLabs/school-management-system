/**
 * Tenant service - fetches tenant/school info for branding
 * Uses public API - no auth required
 */
import { resolveApiBaseUrl } from './api';
import { resolveApiOrigin } from '../utils/mediaUrl';

const API_BASE = resolveApiBaseUrl();
const API_ORIGIN = resolveApiOrigin();

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
  if (logoUrl.startsWith('http') || logoUrl.startsWith('data:')) return logoUrl;
  return `${API_ORIGIN}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
}

export async function fetchTenantById(id: number): Promise<TenantBranding | null> {
  try {
    const res = await fetch(`${API_BASE}/tenant/by-id/${id}`);
    const text = await res.text();
    if (!res.ok) return null;
    const data = text.trim() ? (JSON.parse(text) as { tenant?: TenantBranding }) : {};
    return data?.tenant ?? null;
  } catch {
    return null;
  }
}

export async function fetchTenantBySlug(slug: string): Promise<TenantBranding | null> {
  try {
    const res = await fetch(`${API_BASE}/tenant/by-slug/${encodeURIComponent(slug)}`);
    const text = await res.text();
    if (!res.ok) return null;
    const data = text.trim() ? (JSON.parse(text) as { tenant?: TenantBranding }) : {};
    return data?.tenant ?? null;
  } catch {
    return null;
  }
}
