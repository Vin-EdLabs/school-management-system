import { resolveLogoUrl } from '@/services/tenantService';
import { getTenantSchoolUrl } from '@/utils/tenantHost';
import type { AppointmentLetterData } from './AppointmentLetterDocument';

export async function fetchLogoAsDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  const resolved = resolveLogoUrl(logoUrl || null);
  if (!resolved) return null;
  if (resolved.startsWith('data:')) return resolved;
  try {
    const res = await fetch(resolved, { credentials: 'include' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function resolveLetterPortalUrl(data: AppointmentLetterData): string | null {
  const pa = data.portalAccess;
  if (pa?.portalUrl) return pa.portalUrl;
  const slug = pa?.portalSlug || data.school.portalSlug;
  const tenantId = pa?.tenantId || data.school.tenantId;
  if (slug || tenantId) {
    return getTenantSchoolUrl(slug, tenantId);
  }
  return null;
}

export async function prepareLetterForPdf(data: AppointmentLetterData): Promise<AppointmentLetterData> {
  const logoData = await fetchLogoAsDataUrl(data.school.logoUrl);
  const portalUrl = resolveLetterPortalUrl(data);
  return {
    ...data,
    school: {
      ...data.school,
      logoUrl: logoData || data.school.logoUrl,
    },
    portalAccess: data.portalAccess
      ? { ...data.portalAccess, portalUrl: portalUrl || data.portalAccess.portalUrl }
      : undefined,
  };
}
