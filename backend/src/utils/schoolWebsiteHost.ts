/** Public school websites: {schoolSlug}-{suffix}.scholarnerve.com (default suffix: edu) */

export const SCHOLARNERVE_BASE_DOMAIN = 'scholarnerve.com';
export const DEFAULT_WEBSITE_URL_SUFFIX = 'edu';

const LEGACY_DOMAIN_LABELS = new Set(['edu', 'schoolsite']);

export function normalizeHost(rawHost: string): string {
  let host = rawHost.toLowerCase().trim();
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

export function validateWebsiteUrlSuffix(raw: string): string | null {
  const value = normalizeWebsiteUrlSuffix(raw);
  if (!value) return 'URL suffix is required';
  if (value.length > 20) return 'Suffix must be at most 20 characters';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return 'Use letters, numbers, and hyphens only (no leading/trailing hyphen)';
  }
  return null;
}

const RESERVED_PUBLIC_SLUGS = new Set([
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
  'mail',
  'ftp',
  'support',
  'help',
]);

export function normalizePublicWebsiteSlug(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

/** @alias normalizePublicWebsiteSlug */
export function normalizePublicSubdomain(raw: string): string {
  return normalizePublicWebsiteSlug(raw);
}

export function getEffectivePublicWebsiteSlug(tenantSlug: string, publicSubdomain?: string | null): string {
  const custom = normalizePublicWebsiteSlug(String(publicSubdomain || ''));
  if (custom) return custom;
  return normalizePublicWebsiteSlug(tenantSlug);
}

export function validatePublicWebsiteSlug(raw: string): string | null {
  const value = normalizePublicWebsiteSlug(raw);
  if (!value) return 'Public website slug is required';
  if (value.length < 2 || value.length > 63) return 'Slug must be 2–63 characters';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return 'Use letters, numbers, and hyphens only (no leading/trailing hyphen)';
  }
  if (RESERVED_PUBLIC_SLUGS.has(value)) return 'This slug is reserved';
  return null;
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

/** Parse {slug}-{suffix}.scholarnerve.com (and local dev equivalents). */
export function parsePublicWebsiteHost(rawHost: string): { slug: string; suffix: string } | null {
  const host = normalizeHost(rawHost);
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

/** Legacy hosts: {slug}.edu.scholarnerve.com or {slug}.schoolsite.* */
export function parseLegacySchoolWebsiteHost(rawHost: string): { slug: string; legacyLabel: string } | null {
  const host = normalizeHost(rawHost);
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

export function isSchoolWebsiteHost(rawHost: string): boolean {
  return parsePublicWebsiteHost(rawHost) !== null || parseLegacySchoolWebsiteHost(rawHost) !== null;
}

/** School slug from public website host (new or legacy pattern). */
export function getSchoolWebsiteSlugFromHost(rawHost: string): string | null {
  const parsed = parsePublicWebsiteHost(rawHost);
  if (parsed) return parsed.slug;
  const legacy = parseLegacySchoolWebsiteHost(rawHost);
  return legacy?.slug ?? null;
}

export function getSchoolWebsiteSuffixFromHost(rawHost: string): string | null {
  const parsed = parsePublicWebsiteHost(rawHost);
  return parsed?.suffix ?? null;
}


export function buildSchoolWebsitePublicUrl(
  tenantSlug: string,
  suffix: string = DEFAULT_WEBSITE_URL_SUFFIX,
  opts?: { host?: string; protocol?: string; port?: string; publicSubdomain?: string | null }
) {
  const publicSlug = getEffectivePublicWebsiteSlug(tenantSlug, opts?.publicSubdomain);
  const sfx = normalizeWebsiteUrlSuffix(suffix) || DEFAULT_WEBSITE_URL_SUFFIX;
  const hostLabel = `${publicSlug}-${sfx}`;
  const refHost = normalizeHost(opts?.host || '');
  const protocol = opts?.protocol || 'https:';
  const port = opts?.port ?? '';

  if (refHost.includes('localhost') || refHost === '127.0.0.1') {
    return `${protocol}//${hostLabel}.localhost${port}`;
  }
  if (refHost.endsWith('.lvh.me')) {
    return `${protocol}//${hostLabel}.lvh.me${port}`;
  }
  return `${protocol}//${hostLabel}.${SCHOLARNERVE_BASE_DOMAIN}`;
}

export function buildLegacySchoolWebsiteRedirectUrl(
  legacySlug: string,
  suffix: string,
  rawHost: string,
  opts?: { protocol?: string; port?: string; publicSubdomain?: string | null; tenantSlug?: string }
): string {
  const protocol = opts?.protocol || 'https:';
  const port = opts?.port ?? '';
  const host = normalizeHost(rawHost);
  const tenantSlug = opts?.tenantSlug || legacySlug;
  const target = buildSchoolWebsitePublicUrl(tenantSlug, suffix, {
    host,
    protocol,
    port: port || (host.includes('localhost') ? ':5173' : ''),
    publicSubdomain: opts?.publicSubdomain,
  });
  return target;
}
