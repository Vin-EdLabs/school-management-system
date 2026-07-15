/** Public school websites: {publicSlug}-{suffix}.scholarnerve.com (portal uses tenant slug only) */

export const SCHOLARNERVE_BASE_DOMAIN = 'scholarnerve.com';
export const DEFAULT_WEBSITE_URL_SUFFIX = 'edu';

const LEGACY_DOMAIN_LABELS = new Set(['edu', 'schoolsite']);

function normalizeHost(hostname: string): string {
  let host = hostname.toLowerCase().trim();
  if (host.startsWith('www.')) host = host.slice(4);
  const colon = host.indexOf(':');
  if (colon > -1) host = host.slice(0, colon);
  return host;
}

export function normalizeWebsiteUrlSuffix(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 20);
}

export function normalizePublicWebsiteSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

export function getEffectivePublicWebsiteSlug(tenantSlug: string, publicSubdomain?: string | null): string {
  const custom = normalizePublicWebsiteSlug(String(publicSubdomain || ''));
  if (custom) return custom;
  return normalizePublicWebsiteSlug(tenantSlug);
}

/** @alias getEffectivePublicWebsiteSlug */
export function getEffectiveWebsiteSubdomain(tenantSlug: string, publicSubdomain?: string | null): string {
  return getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain);
}

export function getSchoolUrls(
  tenantSlug: string,
  suffix: string = DEFAULT_WEBSITE_URL_SUFFIX,
  publicSubdomain?: string | null
) {
  const portalSlug = normalizePublicWebsiteSlug(tenantSlug);
  const publicSlug = getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain);
  const sfx = normalizeWebsiteUrlSuffix(suffix) || DEFAULT_WEBSITE_URL_SUFFIX;
  return {
    portal: `${portalSlug}.${SCHOLARNERVE_BASE_DOMAIN}`,
    publicSite: `${publicSlug}-${sfx}.${SCHOLARNERVE_BASE_DOMAIN}`,
    publicHost: `${publicSlug}-${sfx}.${SCHOLARNERVE_BASE_DOMAIN}`,
    publicSlug,
    portalSlug,
    suffix: sfx,
  };
}

export function parsePublicWebsiteHost(hostname: string): { slug: string; suffix: string } | null {
  const host = normalizeHost(hostname);
  if (!host) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  let label: string | null = null;

  if (parts.length >= 3 && parts[parts.length - 2] === 'scholarnerve' && parts[parts.length - 1] === 'com') {
    label = parts[0];
  } else if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    label = parts[0];
  } else if (
    parts.length >= 3 &&
    parts[parts.length - 2] === 'lvh' &&
    parts[parts.length - 1] === 'me'
  ) {
    label = parts[0];
  } else {
    return null;
  }

  if (!label || !label.includes('-')) return null;

  const lastDash = label.lastIndexOf('-');
  const slug = label.substring(0, lastDash);
  const suffix = label.substring(lastDash + 1);
  if (!slug || !suffix) return null;

  return { slug, suffix };
}

export function parseLegacySchoolWebsiteHost(hostname: string): { slug: string; legacyLabel: string } | null {
  const host = normalizeHost(hostname);
  if (!host) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 3) return null;

  const label = parts[1];
  if (!LEGACY_DOMAIN_LABELS.has(label)) return null;

  if (label === 'edu') {
    if (parts[2] === 'localhost') return { slug: parts[0], legacyLabel: 'edu' };
    if (parts.length >= 4 && parts[2] === 'lvh' && parts[3] === 'me') {
      return { slug: parts[0], legacyLabel: 'edu' };
    }
    if (parts.length >= 4 && parts[2] === 'scholarnerve' && parts[3] === 'com') {
      return { slug: parts[0], legacyLabel: 'edu' };
    }
  }

  if (label === 'schoolsite') {
    if (parts[2] === 'localhost') return { slug: parts[0], legacyLabel: 'schoolsite' };
    if (parts.length >= 4 && parts[2] === 'lvh' && parts[3] === 'me') {
      return { slug: parts[0], legacyLabel: 'schoolsite' };
    }
    if (parts.length >= 3) return { slug: parts[0], legacyLabel: 'schoolsite' };
  }

  return null;
}

export function detectSchoolWebsiteSlugFromHost(hostname: string = window.location.hostname): string | null {
  const parsed = parsePublicWebsiteHost(hostname);
  if (parsed) return parsed.slug;
  const legacy = parseLegacySchoolWebsiteHost(hostname);
  return legacy?.slug ?? null;
}

export function detectSchoolWebsiteSuffixFromHost(hostname: string = window.location.hostname): string | null {
  const parsed = parsePublicWebsiteHost(hostname);
  return parsed?.suffix ?? null;
}

export function getSchoolWebsitePublicUrl(
  tenantSlug: string,
  suffix: string = DEFAULT_WEBSITE_URL_SUFFIX,
  publicSubdomain?: string | null
): string {
  const publicSlug = getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain);
  const sfx = normalizeWebsiteUrlSuffix(suffix) || DEFAULT_WEBSITE_URL_SUFFIX;
  const hostLabel = `${publicSlug}-${sfx}`;
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return `${protocol}//${hostLabel}.localhost${port}`;
  }

  if (hostname.endsWith('.lvh.me')) {
    return `${protocol}//${hostLabel}.lvh.me${port}`;
  }

  return `${protocol}//${hostLabel}.${SCHOLARNERVE_BASE_DOMAIN}`;
}

export function getSchoolWebsiteDomainSuffix(suffix: string = DEFAULT_WEBSITE_URL_SUFFIX): string {
  const sfx = normalizeWebsiteUrlSuffix(suffix) || DEFAULT_WEBSITE_URL_SUFFIX;
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return `-${sfx}.localhost${port}`;
  }
  if (hostname.endsWith('.lvh.me')) {
    return `-${sfx}.lvh.me${port}`;
  }
  return `-${sfx}.${SCHOLARNERVE_BASE_DOMAIN}`;
}

export function getPortalPublicUrl(schoolSlug: string): string {
  const slug = normalizePublicWebsiteSlug(schoolSlug);
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
  const port = typeof window !== 'undefined' && window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1') {
    return `${protocol}//${slug}.localhost${port}`;
  }
  if (hostname.endsWith('.lvh.me')) {
    return `${protocol}//${slug}.lvh.me${port}`;
  }
  return `${protocol}//${slug}.${SCHOLARNERVE_BASE_DOMAIN}`;
}

export function isSchoolWebsiteHost(hostname: string = window.location.hostname): boolean {
  return parsePublicWebsiteHost(hostname) !== null || parseLegacySchoolWebsiteHost(hostname) !== null;
}

export function buildLegacyRedirectUrl(
  tenantSlug: string,
  suffix: string = DEFAULT_WEBSITE_URL_SUFFIX,
  publicSubdomain?: string | null
): string {
  return getSchoolWebsitePublicUrl(tenantSlug, suffix, publicSubdomain);
}
