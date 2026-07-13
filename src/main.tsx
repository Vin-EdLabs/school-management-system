import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

import { detectTenantSlugFromHost } from './utils/tenantHost'
import { initSystemErrorReporter } from './utils/systemErrorReporter'
import {
  applyTenantPwaBranding,
  buildPwaLogoUrl,
  buildPwaQueryParams,
  detectPwaKind,
  detectTenantIdFromPath,
} from './utils/pwaBranding'
import {
  getSplashBranding,
  saveSplashBranding,
  SPLASH_LAST_TENANT_SLUG_KEY,
} from './utils/splashCache'

const API_BASE = (() => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001/api';
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return '/api';
})();

const BOOTSTRAP_TIMEOUT_MS = 4000;

function detectSchSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/sch\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function hideSplash() {
  const splash = document.getElementById('sn-splash');
  if (splash) splash.classList.add('sn-splash-hidden');
}

function resolveSplashCacheKey(
  tenant: { id: number; slug?: string | null },
  pathSlug: string | null,
  hostSlug: string | null,
  pathTenantId: number | null,
): string {
  return tenant.slug || pathSlug || hostSlug || (pathTenantId ? `id-${pathTenantId}` : `id-${tenant.id}`);
}

function parseTenantIdFromCacheSlug(cacheSlug: string): number | null {
  if (cacheSlug.startsWith('id-')) {
    const parsed = Number(cacheSlug.slice(3));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function applyCachedBrandingFallback() {
  try {
    const cacheSlug = localStorage.getItem(SPLASH_LAST_TENANT_SLUG_KEY);
    if (!cacheSlug) return;

    const branding = getSplashBranding(cacheSlug);
    if (!branding) return;

    const path = window.location.pathname;
    const kind = detectPwaKind(path);
    const tenantId =
      branding.tenantId ??
      parseTenantIdFromCacheSlug(cacheSlug) ??
      detectTenantIdFromPath(path);

    if (!tenantId) return;

    applyTenantPwaBranding(
      {
        id: tenantId,
        name: branding.schoolName,
        slug: cacheSlug.startsWith('id-') ? null : cacheSlug,
        logo_url: branding.logoUrl,
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
      },
      kind,
    );
  } catch (error) {
    console.warn('[PWA] Offline branding fallback failed:', error);
  }
}

async function bootstrapTenantBrandingAndManifest() {
  const path = window.location.pathname;
  const pathSlug = detectSchSlugFromPath(path);
  const hostSlug = detectTenantSlugFromHost();
  const slug = pathSlug || hostSlug;
  const pathTenantId = detectTenantIdFromPath(path);
  const kind = detectPwaKind(path);
  const headers: Record<string, string> = {};
  if (slug) headers['X-Tenant-Slug'] = slug;
  if (!slug && pathTenantId) headers['X-Tenant-Id'] = String(pathTenantId);

  const tenantRes = slug
    ? await fetch(`${API_BASE}/tenant/resolve`, { credentials: 'include', headers })
    : pathTenantId
      ? await fetch(`${API_BASE}/tenant/by-id/${pathTenantId}`, { credentials: 'include' })
      : await fetch(`${API_BASE}/tenant/resolve`, { credentials: 'include', headers });

  if (!tenantRes.ok) {
    throw new Error(`Tenant resolve failed (${tenantRes.status})`);
  }

  const tenantData = await tenantRes.json();
  const tenant = tenantData?.tenant || null;

  if (tenant) {
    applyTenantPwaBranding(
      {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      },
      kind,
    );

    const cacheKey = resolveSplashCacheKey(tenant, pathSlug, hostSlug, pathTenantId);
    const params = buildPwaQueryParams(
      {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        logo_url: tenant.logo_url,
        primary_color: tenant.primary_color,
        secondary_color: tenant.secondary_color,
      },
      kind,
      pathTenantId,
    );
    const logoUrl = buildPwaLogoUrl(params, 180);

    saveSplashBranding({
      schoolName: tenant.name || 'ScholarNerve',
      logoUrl,
      primaryColor: tenant.primary_color || '#0f766e',
      secondaryColor: tenant.secondary_color || tenant.primary_color || '#0f766e',
      cachedAt: Date.now(),
      tenantSlug: cacheKey,
      tenantId: tenant.id,
    });

    try {
      localStorage.setItem(SPLASH_LAST_TENANT_SLUG_KEY, cacheKey);
    } catch {
      // ignore
    }
  }
}

function bootstrapWithTimeout() {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(() => reject(new Error('bootstrap timeout')), BOOTSTRAP_TIMEOUT_MS);
  });
  return Promise.race([bootstrapTenantBrandingAndManifest(), timeout]);
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const host = window.location.hostname;
    const isDevHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.lvh.me');
    if (isDevHost) {
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready.catch(() =>
        navigator.serviceWorker.getRegistration()
      );
      registration?.update().catch(() => undefined);
    } catch {
      // index.html registers the service worker before the bundle loads.
    }
  }
}

function mountAppAndHideSplash() {
  root.render(<App />);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.setTimeout(() => {
        hideSplash();
      }, 100);
    });
  });
}

initSystemErrorReporter();

document.addEventListener('wheel', (e) => {
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
    (document.activeElement as HTMLInputElement).blur();
  }
});

document.addEventListener(
  'focusin',
  (e) => {
    const t = e.target;
    if (t instanceof HTMLTextAreaElement) {
      window.setTimeout(() => {
        t.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
    }
  },
  true
);

const root = createRoot(document.getElementById('root')!);

void (async () => {
  try {
    await bootstrapWithTimeout();
  } catch (error) {
    console.warn('[PWA] Tenant branding bootstrap failed (offline/timeout):', error);
    applyCachedBrandingFallback();
  } finally {
    void registerServiceWorker();
    mountAppAndHideSplash();
  }
})();
