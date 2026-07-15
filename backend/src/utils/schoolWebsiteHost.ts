/** Public school websites: {subdomain}.edu.scholarnerve.com */

export const SCHOOL_WEBSITE_DOMAIN_LABEL = 'edu';
export const SCHOOL_WEBSITE_PRODUCTION_SUFFIX = `${SCHOOL_WEBSITE_DOMAIN_LABEL}.scholarnerve.com`;

const RESERVED_SUBDOMAINS = new Set([
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

export function normalizeHost(rawHost: string): string {
  let host = rawHost.toLowerCase().trim();
  if (host.startsWith('www.')) host = host.slice(4);
  const colon = host.indexOf(':');
  if (colon > -1) host = host.slice(0, colon);
  return host;
}

/** Extract website subdomain from host, or null if not a school website host. */
export function getSchoolWebsiteSubdomainFromHost(rawHost: string): string | null {
  const host = normalizeHost(rawHost);
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

export function isSchoolWebsiteHost(rawHost: string): boolean {
  return getSchoolWebsiteSubdomainFromHost(rawHost) !== null;
}

export function normalizePublicSubdomain(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '');
}

export function validatePublicSubdomain(subdomain: string): string | null {
  const value = normalizePublicSubdomain(subdomain);
  if (!value) return 'Subdomain is required';
  if (value.length < 2 || value.length > 63) return 'Subdomain must be 2–63 characters';
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return 'Use letters, numbers, and hyphens only (no leading/trailing hyphen)';
  }
  if (RESERVED_SUBDOMAINS.has(value)) return 'This subdomain is reserved';
  return null;
}

export function buildSchoolWebsitePublicUrl(subdomain: string, opts?: { host?: string; protocol?: string; port?: string }) {
  const sub = normalizePublicSubdomain(subdomain);
  const host = normalizeHost(opts?.host || '');
  const protocol = opts?.protocol || 'https:';
  const port = opts?.port ?? '';

  if (host.includes('localhost') || host === '127.0.0.1') {
    return `${protocol}//${sub}.${SCHOOL_WEBSITE_DOMAIN_LABEL}.localhost${port}`;
  }
  if (host.endsWith('.lvh.me')) {
    return `${protocol}//${sub}.${SCHOOL_WEBSITE_DOMAIN_LABEL}.lvh.me${port}`;
  }
  return `${protocol}//${sub}.${SCHOOL_WEBSITE_PRODUCTION_SUFFIX}`;
}
