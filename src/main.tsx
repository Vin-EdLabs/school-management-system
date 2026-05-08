import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { detectTenantSlugFromHost } from './utils/tenantHost'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
let manifestBlobUrl: string | null = null;

function detectTenantIdFromPath(pathname: string = window.location.pathname): number | null {
  const portalMatch = pathname.match(/^\/portal\/(\d+)(\/|$)/i);
  if (portalMatch) return Number(portalMatch[1]);
  const schoolMatch = pathname.match(/^\/school\/(\d+)(\/|$)/i);
  if (schoolMatch) return Number(schoolMatch[1]);
  return null;
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
    const slug = detectTenantSlugFromHost();
    const tenantId = detectTenantIdFromPath();
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
      document.title = `${tenant.name} Parent Portal`;
      const logoUrl = tenant.logo_url as string | undefined;
      if (logoUrl) {
        let appleTouch = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
        if (!appleTouch) {
          appleTouch = document.createElement('link');
          appleTouch.rel = 'apple-touch-icon';
          document.head.appendChild(appleTouch);
        }
        appleTouch.href = logoUrl;
      }
    }

    // Set the manifest URL directly to the API instead of using a Blob URL.
    // Chrome/Android cannot generate a WebAPK from a blob: URL.
    // Use a relative path that the Service Worker intercepts.
    // This solves the 'Cross-Origin Manifest' security errors in Chrome.
    const manifestUrl = `/manifest.json?${slug ? `slug=${slug}` : `tenantId=${tenantId || ''}`}`;
    
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

bootstrapTenantBrandingAndManifest().finally(registerServiceWorker);

createRoot(document.getElementById("root")!).render(<App />);
