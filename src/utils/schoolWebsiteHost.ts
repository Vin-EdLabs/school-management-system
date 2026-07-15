/** Public school websites at {subdomain}.edu.scholarnerve.com */

export const SCHOOL_WEBSITE_DOMAIN_LABEL = 'edu';
export const SCHOOL_WEBSITE_PRODUCTION_SUFFIX = `${SCHOOL_WEBSITE_DOMAIN_LABEL}.scholarnerve.com`;

function normalizeHost(hostname: string): string {
  let host = hostname.toLowerCase().trim();
  if (host.startsWith('www.')) host = host.slice(4);
  const colon = host.indexOf(':');
  if (colon > -1) host = host.slice(0, colon);
  return host;
}

/** Website subdomain from the current (or given) host. */
export function detectSchoolWebsiteSlugFromHost(hostname: string = window.location.hostname): string | null {
  const host = normalizeHost(hostname);
  if (!host) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 3) return null;

  // {subdomain}.edu.localhost
  if (parts[1] === SCHOOL_WEBSITE_DOMAIN_LABEL && parts[2] === 'localhost') {
    return parts[0];
  }

  // {subdomain}.edu.lvh.me
  if (
    parts.length >= 4 &&
    parts[1] === SCHOOL_WEBSITE_DOMAIN_LABEL &&
    parts[2] === 'lvh' &&
    parts[3] === 'me'
  ) {
    return parts[0];
  }

  // {subdomain}.edu.scholarnerve.com
  if (
    parts.length >= 4 &&
    parts[1] === SCHOOL_WEBSITE_DOMAIN_LABEL &&
    parts[2] === 'scholarnerve' &&
    parts[3] === 'com'
  ) {
    return parts[0];
  }

  // Legacy: {subdomain}.schoolsite.*
  if (parts[1] === 'schoolsite') {
    if (parts[2] === 'localhost') return parts[0];
    if (parts.length >= 4 && parts[2] === 'lvh' && parts[3] === 'me') return parts[0];
    if (parts.length >= 3) return parts[0];
  }

  return null;
}

export function getEffectiveWebsiteSubdomain(tenantSlug: string, publicSubdomain?: string | null): string {
  const custom = String(publicSubdomain || '').trim().toLowerCase();
  return custom || tenantSlug;
}

export function getSchoolWebsitePublicUrl(subdomain: string): string {
  const sub = subdomain.trim().toLowerCase();
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return `${protocol}//${sub}.${SCHOOL_WEBSITE_DOMAIN_LABEL}.localhost${port}`;
  }

  if (hostname.endsWith('.lvh.me')) {
    return `${protocol}//${sub}.${SCHOOL_WEBSITE_DOMAIN_LABEL}.lvh.me${port}`;
  }

  return `${protocol}//${sub}.${SCHOOL_WEBSITE_PRODUCTION_SUFFIX}`;
}

export function getSchoolWebsiteDomainSuffix(): string {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return `${SCHOOL_WEBSITE_DOMAIN_LABEL}.localhost${port}`;
  }
  if (hostname.endsWith('.lvh.me')) {
    return `${SCHOOL_WEBSITE_DOMAIN_LABEL}.lvh.me${port}`;
  }
  return SCHOOL_WEBSITE_PRODUCTION_SUFFIX;
}

export function isSchoolWebsiteHost(hostname: string = window.location.hostname): boolean {
  return detectSchoolWebsiteSlugFromHost(hostname) !== null;
}
