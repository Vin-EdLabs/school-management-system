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
  detectPwaKind,
  detectTenantIdFromPath,
} from './utils/pwaBranding'

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

async function bootstrapTenantBrandingAndManifest() {
  try {
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
    }
  } catch (error) {
    console.warn('[PWA] Tenant branding bootstrap failed:', error);
  }
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

bootstrapTenantBrandingAndManifest().finally(registerServiceWorker);

createRoot(document.getElementById("root")!).render(<App />);
