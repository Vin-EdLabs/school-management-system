export function detectTenantSlugFromHost(hostname: string = window.location.hostname): string | null {
  const host = hostname.toLowerCase();
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

  // Exclude main application domains directly
  const excludedDomains = [
    'scholarnerve.com',
    'www.scholarnerve.com',
    'scholarnerve.onrender.com',
    'school-management-system.onrender.com'
  ];
  if (excludedDomains.includes(host)) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  // Local wildcard testing: {slug}.lvh.me, {slug}.localhost
  if (host.endsWith('.lvh.me') || host.endsWith('.localhost')) {
    return parts.length >= 3 ? parts[0] : null;
  }

  // Common subdomains that should never be treated as tenant slugs
  const reservedSubdomains = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal'];
  if (reservedSubdomains.includes(parts[0])) return null;

  // Production wildcard domains:
  // For .onrender.com (3 parts: appname.onrender.com), we need 4 parts for a tenant (tenant.appname.onrender.com)
  if (host.endsWith('.onrender.com')) {
    return parts.length >= 4 ? parts[0] : null;
  }

  // For custom domains (e.g. tenant.scholarnerve.com), we need at least 3 parts
  return parts.length >= 3 ? parts[0] : null;
}

