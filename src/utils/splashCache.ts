export interface SplashBranding {
  schoolName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  cachedAt: number;
  tenantSlug: string;
  tenantId?: number;
}

const BRANDING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function brandingKey(tenantSlug: string) {
  return `sn_splash_${tenantSlug}`;
}

function logoKey(tenantSlug: string) {
  return `sn_splash_logo_${tenantSlug}`;
}

export function isSplashBrandingFresh(branding: SplashBranding): boolean {
  return Date.now() - branding.cachedAt < BRANDING_TTL_MS;
}

export function saveSplashBranding(branding: SplashBranding): void {
  try {
    localStorage.setItem(brandingKey(branding.tenantSlug), JSON.stringify(branding));
  } catch {
    // Storage full or blocked — metadata is optional for splash.
  }

  if (!branding.logoUrl) return;

  void (async () => {
    try {
      const response = await fetch(branding.logoUrl, { credentials: 'include' });
      if (!response.ok) return;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) {
        localStorage.setItem(logoKey(branding.tenantSlug), dataUrl);
      }
    } catch {
      // Logo prefetch is best-effort; splash still uses logoUrl or color fallback.
    }
  })();
}

export function getSplashBranding(tenantSlug: string): SplashBranding | null {
  try {
    const raw = localStorage.getItem(brandingKey(tenantSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SplashBranding;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getSplashLogoDataUrl(tenantSlug: string): string | null {
  try {
    return localStorage.getItem(logoKey(tenantSlug));
  } catch {
    return null;
  }
}

export function clearSplashBranding(tenantSlug: string): void {
  try {
    localStorage.removeItem(brandingKey(tenantSlug));
    localStorage.removeItem(logoKey(tenantSlug));
  } catch {
    // ignore
  }
}

export const SPLASH_LAST_TENANT_SLUG_KEY = 'sn_last_tenant_slug';
