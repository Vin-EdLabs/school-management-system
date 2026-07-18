import type { Request } from 'express';
import { isPlatformAdminPath } from '../constants/platformAdminRoute.js';
import { isSchoolWebsiteHost } from './schoolWebsiteHost.js';

const EXCLUDED_DOMAINS = [
  'scholarnerve.com',
  'scholarnerve.onrender.com',
  'school-management-system.onrender.com',
];

const RESERVED_SUBDOMAINS = [
  'www',
  'api',
  'app',
  'admin',
  'dev',
  'staging',
  'scholarnerve',
  'portal',
  'school',
  'schoolsite',
  'edu',
  'partners',
];

/** Normalize host from client-facing signals (query, forwarded header, or request hostname). */
export function normalizeHost(rawHost: string): string {
  let host = rawHost.toLowerCase().trim();
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }
  // Strip port if present (e.g. tenant.localhost:8080)
  const colon = host.indexOf(':');
  if (colon > -1) {
    host = host.slice(0, colon);
  }
  return host;
}

export function resolveClientHost(req: Request): string {
  const fromQuery = req.query.host ? String(req.query.host) : '';
  const forwarded = req.get('x-forwarded-host')?.split(',')[0]?.trim() || '';
  const hostname = req.hostname || '';
  return normalizeHost(fromQuery || forwarded || hostname);
}

export function getTenantSlugFromHost(host: string): string | null {
  const normalized = normalizeHost(host);
  if (!normalized) return null;
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  ) {
    return null;
  }
  if (EXCLUDED_DOMAINS.includes(normalized)) return null;

  const parts = normalized.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  // Public school websites: {subdomain}.edu.* or legacy {subdomain}.schoolsite.*
  if (isSchoolWebsiteHost(normalized)) {
    return null;
  }

  if (normalized.endsWith('.localhost')) {
    const slug = parts.length >= 2 ? parts[0] : null;
    if (slug && RESERVED_SUBDOMAINS.includes(slug)) return null;
    return slug;
  }
  if (normalized.endsWith('.lvh.me')) {
    return parts.length >= 3 ? parts[0] : null;
  }

  if (RESERVED_SUBDOMAINS.includes(parts[0])) return null;

  if (normalized.endsWith('.onrender.com')) {
    return parts.length >= 4 ? parts[0] : null;
  }

  return parts.length >= 3 ? parts[0] : null;
}

export function isTenantSubdomainHost(host: string): boolean {
  if (isSchoolWebsiteHost(host)) return false;
  return getTenantSlugFromHost(host) !== null;
}

export type PwaKind = 'school' | 'parent' | 'super-admin';

export function resolvePwaKind(
  req: Request,
  clientHost: string,
  explicitKind: string | null
): PwaKind {
  if (explicitKind === 'school' || explicitKind === 'parent' || explicitKind === 'super-admin') {
    return explicitKind;
  }

  const onTenantSubdomain = isTenantSubdomainHost(clientHost);

  let refererPath = '';
  const refererHeader = req.headers.referer;
  if (refererHeader) {
    try {
      refererPath = new URL(refererHeader).pathname;
    } catch {
      refererPath = '';
    }
  }

  if (isPlatformAdminPath(refererPath)) return 'super-admin';
  if (refererPath.startsWith('/portal')) return 'parent';

  // On a school subdomain, default to the school app unless explicitly on /portal.
  if (onTenantSubdomain) return 'school';

  if (refererPath.startsWith('/school') || refererPath.startsWith('/sch')) {
    return 'school';
  }

  return 'school';
}
