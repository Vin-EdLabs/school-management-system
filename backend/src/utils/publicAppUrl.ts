import type { Request } from 'express';

const DEFAULT_BASE_DOMAIN = 'scholarnerve.com';

type UrlRequest = Pick<Request, 'protocol' | 'get' | 'hostname' | 'headers'>;

export function getPublicBaseDomain(): string {
  return (process.env.PUBLIC_BASE_DOMAIN || DEFAULT_BASE_DOMAIN).replace(/^\.+/, '').toLowerCase();
}

/** True when deployed (VPS/Render), not local dev without explicit prod URLs. */
export function isProductionDeploy(): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  if (process.env.RENDER) return true;
  if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') return true;

  const publicUrl = (process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL || '').trim();
  if (publicUrl.startsWith('https://') && !publicUrl.includes('localhost')) return true;

  const partnerUrl = (process.env.PARTNER_PORTAL_URL || '').trim();
  if (partnerUrl.startsWith('https://') && !partnerUrl.includes('localhost')) return true;

  return false;
}

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, '');
}

function devFrontendOrigin(): string {
  const port = process.env.FRONTEND_DEV_PORT || '8080';
  return `http://localhost:${port}`;
}

function devPartnerPortalOrigin(): string {
  const port = process.env.FRONTEND_DEV_PORT || '8080';
  return `http://partners.localhost:${port}`;
}

function prodApexOrigin(): string {
  return `https://${getPublicBaseDomain()}`;
}

function prodPartnerPortalOrigin(): string {
  return `https://partners.${getPublicBaseDomain()}`;
}

function originFromRequest(req: UrlRequest): string | null {
  const protocol = req.protocol || (isProductionDeploy() ? 'https' : 'http');
  const forwardedHost = req.get('x-forwarded-host')?.split(',')[0]?.trim();
  const hostHeader = req.get('host') || req.hostname || '';
  const host = (forwardedHost || hostHeader).toLowerCase();
  if (!host) return null;

  const hostname = host.split(':')[0];
  const domain = getPublicBaseDomain();

  if (
    hostname.includes('onrender.com') ||
    hostname.startsWith('api.') ||
    hostname.endsWith('.onrender.com')
  ) {
    return isProductionDeploy() ? prodApexOrigin() : null;
  }

  if (hostname.startsWith('partners.')) {
    return isProductionDeploy() ? prodPartnerPortalOrigin() : devPartnerPortalOrigin();
  }

  const referer = req.headers.referer;
  if (referer) {
    try {
      const ref = new URL(referer);
      if (ref.hostname.startsWith('partners.')) {
        return isProductionDeploy() ? prodPartnerPortalOrigin() : devPartnerPortalOrigin();
      }
      return ref.origin;
    } catch {
      // fall through
    }
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return devFrontendOrigin();
  }

  if (hostname.endsWith('.localhost')) {
    const port = host.includes(':') ? host.split(':')[1] : (process.env.FRONTEND_DEV_PORT || '8080');
    return `${protocol}://${hostname}:${port}`;
  }

  if (isProductionDeploy() && (hostname === domain || hostname.endsWith(`.${domain}`))) {
    return prodApexOrigin();
  }

  return stripTrailingSlash(`${protocol}://${host}`);
}

/** Main app origin — partner emblem and marketing assets live here. */
export function resolvePublicAppUrl(req?: UrlRequest): string {
  const override = process.env.PUBLIC_APP_URL || process.env.FRONTEND_URL;
  if (override?.trim()) return stripTrailingSlash(override.trim());

  if (req) {
    const fromReq = originFromRequest(req);
    if (fromReq) {
      // Marketing assets (emblem PNG) live on the apex site, not the partner subdomain.
      try {
        const host = new URL(fromReq).hostname;
        if (host.startsWith('partners.')) return prodApexOrigin();
      } catch {
        // fall through
      }
      return fromReq;
    }
  }

  return isProductionDeploy() ? prodApexOrigin() : devFrontendOrigin();
}

/** Partner portal sign-in link. */
export function resolvePartnerPortalLoginUrl(req?: UrlRequest): string {
  const override = process.env.PARTNER_PORTAL_URL;
  if (override?.trim()) {
    const base = stripTrailingSlash(override.trim());
    return base.endsWith('/login') ? base : `${base}/login`;
  }

  if (req) {
    const referer = req.headers.referer;
    if (referer) {
      try {
        const u = new URL(referer);
        if (u.hostname === 'partners.localhost' || u.hostname.startsWith('partners.')) {
          return stripTrailingSlash(`${u.origin}/login`);
        }
      } catch {
        // fall through
      }
    }
  }

  if (isProductionDeploy()) return `${prodPartnerPortalOrigin()}/login`;

  const port = process.env.FRONTEND_DEV_PORT || '8080';
  return `http://partners.localhost:${port}/login`;
}

/**
 * Links in partner emails — routes through /open so installed PWAs can capture
 * the navigation instead of always opening a new browser tab.
 */
export function resolvePartnerPortalEmailLinkUrl(
  targetPath = '/login',
  req?: UrlRequest,
): string {
  const base = resolvePartnerPortalBaseUrl(req);
  const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${base}/open?to=${encodeURIComponent(path)}&src=email`;
}

/** Partner portal origin (no /login path) — used for reset links. */
export function resolvePartnerPortalBaseUrl(req?: UrlRequest): string {
  return resolvePartnerPortalLoginUrl(req).replace(/\/login\/?$/, '');
}

/** Direct partner portal path (shown in plain-text emails). */
export function resolvePartnerPortalDirectUrl(
  targetPath = '/login',
  req?: UrlRequest,
): string {
  const base = resolvePartnerPortalBaseUrl(req);
  const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${base}${path}`;
}

export type PartnerEmailUrlContext = {
  publicAppUrl?: string;
  partnerLoginUrl?: string;
  partnerDashboardUrl?: string;
  partnerLoginDirectUrl?: string;
  partnerDashboardDirectUrl?: string;
  /** cid:… for sent mail, data:… for admin preview */
  logoSrc?: string;
};

export function resolvePartnerEmailUrls(req?: UrlRequest): PartnerEmailUrlContext {
  return {
    publicAppUrl: resolvePublicAppUrl(req),
    partnerLoginUrl: resolvePartnerPortalEmailLinkUrl('/login', req),
    partnerDashboardUrl: resolvePartnerPortalEmailLinkUrl('/dashboard', req),
    partnerLoginDirectUrl: resolvePartnerPortalDirectUrl('/login', req),
    partnerDashboardDirectUrl: resolvePartnerPortalDirectUrl('/dashboard', req),
  };
}
