/** Partner Network host helpers — partners.scholarnerve.com hosts the partner PWA. */

export function isPartnersHost(hostname: string = window.location.hostname): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  const firstLabel = host.split('.')[0];
  return firstLabel === 'partners';
}

/** URL of the partner portal for the current environment (dev + prod). */
export function getPartnersPortalUrl(): string {
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1' || hostname === '::1') {
    return `${protocol}//partners.localhost${port}`;
  }
  if (hostname.endsWith('.lvh.me') || hostname === 'lvh.me') {
    return `${protocol}//partners.lvh.me${port}`;
  }
  if (hostname.endsWith('.onrender.com')) {
    const baseDomain = hostname.replace(/^[a-z0-9-]+\./, '');
    return `${protocol}//partners.${baseDomain}`;
  }
  return `${protocol}//partners.scholarnerve.com`;
}

/** Partner portal sign-in page. */
export function getPartnersPortalLoginUrl(): string {
  return `${getPartnersPortalUrl()}/login`;
}

/** Public partners landing / apply page (on the main ScholarNerve site). */
export function getPartnersLandingUrl(options?: { apply?: boolean }): string {
  const base = getScholarNerveMainUrl().replace(/\/$/, '');
  const url = `${base}/partners`;
  return options?.apply ? `${url}#apply` : url;
}

/** Main marketing site — for back links from the partner subdomain. */
export function getScholarNerveMainUrl(): string {
  const hostname = window.location.hostname.toLowerCase();
  const protocol = window.location.protocol;
  const port = window.location.port ? `:${window.location.port}` : '';

  if (hostname.includes('localhost') || hostname === '127.0.0.1' || hostname === '::1') {
    return `${protocol}//localhost${port}/`;
  }
  if (hostname.endsWith('.lvh.me') || hostname === 'lvh.me') {
    return `${protocol}//lvh.me${port}/`;
  }
  if (hostname.endsWith('.onrender.com')) {
    const baseDomain = hostname.replace(/^partners\./, '').replace(/^[a-z0-9-]+\./, '');
    return `${protocol}//${baseDomain}/`;
  }
  return `${protocol}//scholarnerve.com/`;
}
