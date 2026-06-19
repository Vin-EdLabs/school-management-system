import { detectTenantSlugFromHost, getSubdomainUrl } from '@/utils/tenantHost';

/** Resolve the public verify URL embedded in ID card QR codes (school subdomain + /verify/...). */
export function resolveIdCardVerifyUrl(
  entityType: string,
  entityId: number,
  slug?: string | null
): string {
  const path = `/verify/${entityType.toLowerCase()}/${entityId}`;
  const resolvedSlug = slug?.trim().toLowerCase() || detectTenantSlugFromHost();

  if (resolvedSlug) {
    const base = getSubdomainUrl(resolvedSlug).replace(/\/$/, '');
    return `${base}${path}`;
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }

  return path;
}

/** Preview placeholder — uses current school subdomain when available. */
export function previewIdCardVerifyUrl(slug?: string | null): string {
  return resolveIdCardVerifyUrl('student', 0, slug);
}
