/**
 * Tenant service - fetches tenant/school info for branding
 * Uses public API - no auth required
 */
import { detectTenantSlugFromHost } from '../utils/tenantHost';

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

export interface ResolveLogoOptions {
  tenantId?: number | null;
  slug?: string | null;
  size?: number;
}

function detectTenantIdFromPath(pathname: string = window.location.pathname): number | null {
  const portalMatch = pathname.match(/^\/portal\/(\d+)(\/|$)/i);
  if (portalMatch) return Number(portalMatch[1]);
  const schoolMatch = pathname.match(/^\/school\/(\d+)(\/|$)/i);
  if (schoolMatch) return Number(schoolMatch[1]);
  return null;
}

function buildLogoServeQuery(options?: ResolveLogoOptions): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams();
  params.set('host', window.location.hostname);

  const tenantId = options?.tenantId ?? detectTenantIdFromPath();
  const slug = options?.slug ?? detectTenantSlugFromHost();

  if (tenantId) params.set('tenantId', String(tenantId));
  else if (slug) params.set('slug', slug);
  else return null;

  return params.toString();
}

export function buildServedLogoUrl(options?: ResolveLogoOptions): string | null {
  const query = buildLogoServeQuery(options);
  if (!query) return null;
  const size = options?.size ?? 192;
  return `${window.location.origin}/pwa-icon-${size}.png?${query}`;
}

export function resolveLogoUrl(
  logoUrl: string | null,
  options?: ResolveLogoOptions,
): string | null {
  if (!logoUrl) return null;

  const served = buildServedLogoUrl(options);
  if (served) return served;

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
