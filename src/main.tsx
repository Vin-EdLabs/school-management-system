import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { detectTenantSlugFromHost } from './utils/tenantHost'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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

    const mRes = await fetch(`${API_BASE}/pwa/manifest`, {
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
    });
    if (mRes.ok) {
      const manifest = await mRes.json();
      const blob = new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' });
      const blobUrl = URL.createObjectURL(blob);
      let link = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'manifest';
        document.head.appendChild(link);
      }
      link.href = blobUrl;
    }
  } catch {
    // Keep app boot resilient if tenant resolve fails.
  }
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
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
