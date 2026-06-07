export function detectTenantSlugFromHost(hostname: string = window.location.hostname): string | null {
  let host = hostname.toLowerCase();
  if (!host) return null;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return null;

  // Strip leading 'www.' if present, to handle 'www.tenant.scholarnerve.com' properly
  if (host.startsWith('www.')) {
    host = host.substring(4);
  }

  // Exclude main application domains directly
  const excludedDomains = [
    'scholarnerve.com',
    'scholarnerve.onrender.com',
    'school-management-system.onrender.com'
  ];
  if (excludedDomains.includes(host)) return null;

  const parts = host.split('.').filter(Boolean);
  if (parts.length < 2) return null;

  // Local wildcard testing: {slug}.lvh.me, {slug}.localhost
  if (host.endsWith('.localhost')) {
    return parts.length >= 2 ? parts[0] : null;
  }
  if (host.endsWith('.lvh.me')) {
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

