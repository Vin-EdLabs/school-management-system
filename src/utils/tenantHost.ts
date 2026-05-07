export function detectTenantSlugFromHost(hostname: string = window.location.hostname): string | null {
  const host = hostname.toLowerCase();
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  // Local wildcard testing: {slug}.lvh.me, {slug}.localhost
  if (host.endsWith('.lvh.me') || host.endsWith('.localhost')) {
    return parts.length >= 3 ? parts[0] : null;
  }

  // Production wildcard domains: {slug}.scholarnerve.com
  return parts[0];
}

