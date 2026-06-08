import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { detectTenantSlugFromHost } from './utils/tenantHost'

const API_BASE = (() => {
  if (import.meta.env.VITE_API_BASE_URL) return import.meta.env.VITE_API_BASE_URL;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001/api';
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return '/api';
})();

function detectSchSlugFromPath(pathname: string): string | null {
  const m = pathname.match(/^\/sch\/([^/]+)/i);
  return m ? decodeURIComponent(m[1]) : null;
}

function detectTenantIdFromPath(pathname: string = window.location.pathname): number | null {
  const portalMatch = pathname.match(/^\/portal\/(\d+)(\/|$)/i);
  if (portalMatch) return Number(portalMatch[1]);
  const schoolMatch = pathname.match(/^\/school\/(\d+)(\/|$)/i);
  if (schoolMatch) return Number(schoolMatch[1]);
  return null;
}

function detectPwaKind(pathname: string): 'parent' | 'school' | 'super-admin' {
  if (/^\/super-admin(\/|$)/i.test(pathname)) return 'super-admin';
  if (/^\/portal(\/|$)/i.test(pathname)) return 'parent';
  if (/^\/(school|sch)(\/|$)/i.test(pathname)) return 'school';
  
  // Root path `/` or other path on a tenant subdomain is the school portal
  if (detectTenantSlugFromHost()) {
    return 'school';
  }

  return 'school';
}

function buildPwaQueryParams(
  slug: string | null,
  tenantId: number | null,
  kind: string,
): URLSearchParams {
  const params = new URLSearchParams();
  if (tenantId) params.set('tenantId', String(tenantId));
  else if (slug) params.set('slug', slug);
  params.set('kind', kind);
  params.set('host', window.location.hostname);
  return params;
}

function setDynamicHeadIcons(logoApiUrl: string) {
  const upsert = (rel: string, sizes?: string, type?: string) => {
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
    el.href = logoApiUrl;
  };

  upsert('apple-touch-icon', '180x180');
  upsert('shortcut icon');
  upsert('icon', '32x32', 'image/png');
  upsert('icon', '16x16', 'image/png');
}

function setCssBrandingVars(tenant: any) {
  const root = document.documentElement;
  const primary = tenant?.primary_color || '#0f766e';
  const secondary = tenant?.secondary_color || '#14b8a6';
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--secondary', secondary);
  if (tenant?.logo_url) {
    root.style.setProperty('--school-logo', `url(${tenant.logo_url})`);
  }

  let themeMeta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
  if (!themeMeta) {
    themeMeta = document.createElement('meta');
    themeMeta.name = 'theme-color';
    document.head.appendChild(themeMeta);
  }
  themeMeta.content = primary;
}

async function bootstrapTenantBrandingAndManifest() {
  try {
    const path = window.location.pathname;
    const pathSlug = detectSchSlugFromPath(path);
    const hostSlug = detectTenantSlugFromHost();
    const slug = pathSlug || hostSlug;
    const tenantId = detectTenantIdFromPath(path);
    const kind = detectPwaKind(path);
    const headers: Record<string, string> = {};
    if (slug) headers['X-Tenant-Slug'] = slug;
    if (!slug && tenantId) headers['X-Tenant-Id'] = String(tenantId);

    const tenantRes = slug
      ? await fetch(`${API_BASE}/tenant/resolve`, { credentials: 'include', headers })
      : tenantId
        ? await fetch(`${API_BASE}/tenant/by-id/${tenantId}`, { credentials: 'include' })
        : await fetch(`${API_BASE}/tenant/resolve`, { credentials: 'include', headers });
    const tenantData = await tenantRes.json();
    const tenant = tenantData?.tenant || null;

    if (tenant) {
      setCssBrandingVars(tenant);
      let portalLabel = 'Parent Portal';
      if (kind === 'school') {
        portalLabel = 'School';
      } else if (kind === 'super-admin') {
        portalLabel = 'Super Admin';
      }

      document.title = `${tenant.name} — ${portalLabel}`;
    }

    const manifestParams = buildPwaQueryParams(slug, tenantId, kind);
    const manifestUrl = `/api/pwa/manifest?${manifestParams.toString()}`;
    const logoApiUrl = `/api/pwa/logo?${manifestParams.toString()}`;

    if (tenant?.logo_url) {
      setDynamicHeadIcons(logoApiUrl);
    }

    let link = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = 'manifest';
      document.head.appendChild(link);
    }
    link.removeAttribute('crossorigin');
    link.href = manifestUrl;
  } catch {
    // Keep app boot resilient if tenant resolve fails.
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      registration.update().catch(() => undefined);
    } catch {
      // No-op in unsupported/local edge cases.
    }
  }
}

// Prevent number inputs from changing value on scroll
document.addEventListener('wheel', (e) => {
  if (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'number') {
    (document.activeElement as HTMLInputElement).blur();
  }
});

// PWA / mobile: keep textarea visible when the virtual keyboard opens (iOS + Android)
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

bootstrapTenantBrandingAndManifest().finally(registerServiceWorker);

createRoot(document.getElementById("root")!).render(<App />);
