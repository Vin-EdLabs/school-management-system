const DEFAULT_BASE_DOMAIN = 'scholarnerve.com';

type RequestLike = { get(name: string): string | undefined };

function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '') || 'school';
}

/** Origin for a school's verify page — `{slug}.scholarnerve.com` in production. */
export function buildSchoolVerifyOrigin(slug: string, req?: RequestLike): string {
  const normalizedSlug = normalizeSlug(slug);

  if (process.env.NODE_ENV === 'production') {
    const baseDomain = (process.env.PUBLIC_BASE_DOMAIN || DEFAULT_BASE_DOMAIN).replace(/^\.+/, '');
    return `https://${normalizedSlug}.${baseDomain}`;
  }

  if (req) {
    const origin = req.get('origin');
    if (origin) {
      try {
        return new URL(origin).origin;
      } catch {
        /* fall through */
      }
    }

    const referer = req.get('referer');
    if (referer) {
      try {
        return new URL(referer).origin;
      } catch {
        /* fall through */
      }
    }
  }

  const port = process.env.FRONTEND_DEV_PORT || '8080';
  return `http://${normalizedSlug}.localhost:${port}`;
}

export function buildIdCardVerifyUrl(
  slug: string,
  entityType: string,
  entityId: number,
  req?: RequestLike
): string {
  const path = `/verify/${entityType.toLowerCase()}/${entityId}`;
  return `${buildSchoolVerifyOrigin(slug, req)}${path}`;
}
