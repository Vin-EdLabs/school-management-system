import { resolveLogoUrl } from '@/services/tenantService';
import { detectTenantSlugFromHost } from '@/utils/tenantHost';

export type PwaKind = 'parent' | 'school' | 'super-admin';

type TenantBranding = {
  id: number;
  name?: string | null;
  slug?: string | null;
  logo_url?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
};

function logoVersionKey(logo: string, tenantId: number): string {
  const input = `${tenantId}:${logo.length}:${logo.slice(0, 64)}:${logo.slice(-64)}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

export function buildPwaQueryParams(
  tenant: TenantBranding | null,
  kind: PwaKind,
  pathTenantId?: number | null,
): URLSearchParams {
  const params = new URLSearchParams();
  const tenantId = tenant?.id ?? pathTenantId ?? null;
  const slug = tenant?.slug || detectTenantSlugFromHost();

  if (tenantId) params.set('tenantId', String(tenantId));
  else if (slug) params.set('slug', slug);

  params.set('kind', kind);
  params.set('host', window.location.hostname);

  if (tenant?.logo_url && tenantId) {
    params.set('v', logoVersionKey(tenant.logo_url, tenantId));
  }

  return params;
}

export function buildPwaLogoUrl(
  params: URLSearchParams,
  size: 180 | 192 | 512,
  maskable = false,
): string {
  const query = new URLSearchParams(params);
  query.set('size', String(size));
  if (maskable) query.set('maskable', '1');
  return `${window.location.origin}/api/pwa/logo?${query.toString()}`;
}

function upsertHeadLink(rel: string, href: string, sizes?: string, type?: string) {
  const selector = sizes
    ? `link[rel='${rel}'][sizes='${sizes}']`
    : `link[rel='${rel}']`;
  let el = document.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    if (sizes) el.sizes = sizes;
    if (type) el.type = type;
    document.head.appendChild(el);
  }
  el.href = href;
}

export function setDynamicHeadIcons(params: URLSearchParams) {
  const icon180 = buildPwaLogoUrl(params, 180);
  const icon192 = buildPwaLogoUrl(params, 192);
  const icon512 = buildPwaLogoUrl(params, 512);

  upsertHeadLink('apple-touch-icon', icon180, '180x180');
  upsertHeadLink('shortcut icon', icon192);
  upsertHeadLink('icon', icon192, '32x32', 'image/png');
  upsertHeadLink('icon', icon192, '16x16', 'image/png');
  upsertHeadLink('icon', icon512, '512x512', 'image/png');
}

export function detectPwaKind(pathname: string): PwaKind {
  if (/^\/super-admin(\/|$)/i.test(pathname)) return 'super-admin';
  if (/^\/portal(\/|$)/i.test(pathname)) return 'parent';
  if (/^\/(school|sch)(\/|$)/i.test(pathname)) return 'school';
  if (detectTenantSlugFromHost()) return 'school';
  return 'school';
}

export function detectTenantIdFromPath(pathname: string = window.location.pathname): number | null {
  const portalMatch = pathname.match(/^\/portal\/(\d+)(\/|$)/i);
  if (portalMatch) return Number(portalMatch[1]);
  const schoolMatch = pathname.match(/^\/school\/(\d+)(\/|$)/i);
  if (schoolMatch) return Number(schoolMatch[1]);
  return null;
}

export async function invalidatePwaCaches() {
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'INVALIDATE_PWA_CACHE' });
  }
}

export function applyTenantPwaBranding(
  tenant: TenantBranding | null,
  kind?: PwaKind,
): void {
  if (!tenant?.id) return;

  const path = window.location.pathname;
  const resolvedKind = kind ?? detectPwaKind(path);
  const params = buildPwaQueryParams(tenant, resolvedKind, detectTenantIdFromPath(path));
  const manifestUrl = `/api/pwa/manifest?${params.toString()}`;

  if (tenant.logo_url) {
    setDynamicHeadIcons(params);
    void invalidatePwaCaches();
  }

  let manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
  if (!manifestLink) {
    manifestLink = document.createElement('link');
    manifestLink.rel = 'manifest';
    document.head.appendChild(manifestLink);
  }
  manifestLink.removeAttribute('crossorigin');
  manifestLink.href = manifestUrl;

  const primary = tenant.primary_color || '#0f766e';
  let themeMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = primary;

  let portalLabel = 'Parent Portal';
  if (resolvedKind === 'school') portalLabel = 'School';
  else if (resolvedKind === 'super-admin') portalLabel = 'Super Admin';
  if (tenant.name) {
    document.title = `${tenant.name} — ${portalLabel}`;
  }

  const resolvedLogo = resolveLogoUrl(tenant.logo_url || null);
  if (resolvedLogo) {
    document.documentElement.style.setProperty('--school-logo', `url(${resolvedLogo})`);
  }

  console.debug('[PWA] Tenant branding applied', {
    tenantId: tenant.id,
    kind: resolvedKind,
    manifestUrl,
    icon192: tenant.logo_url ? buildPwaLogoUrl(params, 192) : null,
  });
}
