import { isSchoolWebsiteHost } from './schoolWebsiteHost';

export function detectTenantSlugFromHost(hostname: string = window.location.hostname): string | null {
  let host = hostname.toLowerCase();
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

  // Strip leading 'www.' if present, to handle 'www.tenant.scholarnerve.com' properly
  if (host.startsWith('www.')) {
    host = host.substring(4);
  }

  if (isSchoolWebsiteHost(host)) return null;

  // Exclude main application domains directly
  const excludedDomains = [
    'scholarnerve.com',
    'scholarnerve.onrender.com',
    'school-management-system.onrender.com'
  ];
  if (excludedDomains.includes(host)) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  const reservedSubdomains = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal', 'school', 'schoolsite', 'edu', 'partners'];

  // Local wildcard testing: {slug}.lvh.me, {slug}.localhost
  if (host.endsWith('.localhost')) {
    const slug = parts.length >= 2 ? parts[0] : null;
    if (slug && reservedSubdomains.includes(slug)) return null;
    return slug;
  }
  if (host.endsWith('.lvh.me')) {
    const slug = parts.length >= 3 ? parts[0] : null;
    if (slug && reservedSubdomains.includes(slug)) return null;
    return slug;
  }

  if (reservedSubdomains.includes(parts[0])) return null;

  // Production wildcard domains:
  // For .onrender.com (3 parts: appname.onrender.com), we need 4 parts for a tenant (tenant.appname.onrender.com)
  if (host.endsWith('.onrender.com')) {
    return parts.length >= 4 ? parts[0] : null;
  }

  return parts.length >= 3 ? parts[0] : null;
}

export function getSubdomainUrl(slug: string): string {
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol; // http: or https:
  
  // Local development options (e.g., localhost:8080 or lvh.me:8080)
  if (hostname.includes('localhost') || hostname === '127.0.0.1' || hostname === '::1') {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${slug}.localhost${port}`;
  }
  
  if (hostname.endsWith('.lvh.me')) {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${protocol}//${slug}.lvh.me${port}`;
  }

  // Render domain resolution: tenant.scholarnerve.onrender.com
  if (hostname.endsWith('.onrender.com')) {
    const baseDomain = hostname.replace(/^[a-z0-9-]+\./, ''); // Strip any existing subdomain
    return `${protocol}//${slug}.${baseDomain}`;
  }

  // Production apex custom domain: tenant.scholarnerve.com
  const baseDomain = hostname.includes('scholarnerve.com') ? 'scholarnerve.com' : hostname.replace(/^[a-z0-9-]+\./, '');
  return `${protocol}//${slug}.${baseDomain}`;
}

/** School staff app URL — subdomain root when slug is known. */
export function getTenantSchoolUrl(slug: string | null | undefined, schoolId?: number): string {
  if (slug) {
    const base = getSubdomainUrl(slug);
    return base.endsWith('/') ? base : `${base}/`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/school/${schoolId ?? ''}`;
}

/** Parent portal URL — clean /portal on tenant subdomain. */
export function getTenantParentPortalUrl(slug: string | null | undefined, schoolId?: number): string {
  if (typeof window !== 'undefined' && detectTenantSlugFromHost()) {
    return `${window.location.origin}/portal`;
  }
  if (slug) {
    return `${getSubdomainUrl(slug)}/portal`;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/portal/${schoolId ?? ''}`;
}

/** Strip legacy /school/:id and /portal/:id prefixes when already on a tenant subdomain. */
export function normalizeLegacyPathOnSubdomain(pathname: string): string | null {
  if (!detectTenantSlugFromHost()) return null;

  const schoolMatch = pathname.match(/^\/school\/\d+(\/.*)?$/);
  if (schoolMatch) {
    return schoolMatch[1] || '/';
  }

  const portalMatch = pathname.match(/^\/portal\/\d+(\/.*)?$/);
  if (portalMatch) {
    return `/portal${portalMatch[1] || ''}`;
  }

  return null;
}

