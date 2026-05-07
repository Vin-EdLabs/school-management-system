import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { detectTenantSlugFromHost } from './utils/tenantHost'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

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
    const res = await fetch(`${API_BASE}/tenant/resolve`, {
      credentials: 'include',
      headers: slug ? { 'X-Tenant-Slug': slug } : undefined,
    });
    const data = await res.json();
    const tenant = data?.tenant || null;

    if (tenant) {
      setCssBrandingVars(tenant);
      document.title = `${tenant.name} Parent Portal`;
    }

    const mRes = await fetch(`${API_BASE}/pwa/manifest`, {
      credentials: 'include',
      headers: slug ? { 'X-Tenant-Slug': slug } : undefined,
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
