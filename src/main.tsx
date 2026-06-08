import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { detectTenantSlugFromHost } from './utils/tenantHost'
import { resolveLogoUrl } from './services/tenantService'

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

  return 'parent';
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
      const resolved = resolveLogoUrl(tenant.logo_url as string | null);
      if (resolved) {
        // Apple touch icon
        let appleTouch = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
        if (!appleTouch) {
          appleTouch = document.createElement('link');
          appleTouch.rel = 'apple-touch-icon';
          document.head.appendChild(appleTouch);
        }
        appleTouch.href = resolved;

        // Also set standard favicon
        let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          favicon.type = 'image/png';
          document.head.appendChild(favicon);
        }
        favicon.href = resolved;

        // Set shortcut icon for older browsers
        let shortcutIcon = document.querySelector("link[rel='shortcut icon']") as HTMLLinkElement | null;
        if (!shortcutIcon) {
          shortcutIcon = document.createElement('link');
          shortcutIcon.rel = 'shortcut icon';
          document.head.appendChild(shortcutIcon);
        }
        shortcutIcon.href = resolved;
      }
    }

    // Use a relative path with query parameters pointing directly to the backend manifest route.
    const manifestUrl = `/api/pwa/manifest?kind=${kind}${slug ? `&slug=${slug}` : tenantId ? `&tenantId=${tenantId}` : ''}`;

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
