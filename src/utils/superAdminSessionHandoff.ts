/** One-time auth token handoff when opening a school subdomain from the super-admin dashboard. */
const HASH_PREFIX = '#sa=';

export function buildSuperAdminHandoffUrl(baseUrl: string, token: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}${HASH_PREFIX}${encodeURIComponent(token)}`;
}

/** Read and clear `#sa=<token>` from the URL. Returns the token or null. */
export function consumeSuperAdminHandoffFromHash(): string | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const token = decodeURIComponent(hash.slice(HASH_PREFIX.length));
  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', cleanUrl);
  return token.trim() || null;
}
