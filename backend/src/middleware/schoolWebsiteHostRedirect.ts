/**
 * Redirect legacy / mismatched public website hostnames to the canonical URL.
 */
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { resolveClientHost } from '../utils/tenantHost.js';
import {
  buildLegacySchoolWebsiteRedirectUrl,
  buildSchoolWebsitePublicUrl,
  getEffectivePublicWebsiteSlug,
  normalizeWebsiteUrlSuffix,
  parseLegacySchoolWebsiteHost,
  parsePublicWebsiteHost,
} from '../utils/schoolWebsiteHost.js';

async function lookupWebsiteTenant(hostSlug: string) {
  const row = await query(
    `SELECT t.slug AS tenant_slug,
            sw.public_subdomain,
            COALESCE(NULLIF(TRIM(sw.website_url_suffix), ''), 'edu') AS website_url_suffix
     FROM tenants t
     LEFT JOIN school_websites sw ON sw.tenant_id = t.id
     WHERE LOWER(COALESCE(NULLIF(TRIM(sw.public_subdomain), ''), t.slug)) = LOWER($1)
        OR LOWER(t.slug) = LOWER($1)
     LIMIT 1`,
    [hostSlug]
  );
  return row.rows[0] as
    | { tenant_slug: string; public_subdomain: string | null; website_url_suffix: string }
    | undefined;
}

export async function schoolWebsiteHostRedirect(req: Request, res: Response, next: NextFunction) {
  try {
    const clientHost = resolveClientHost(req);
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const portHeader = req.get('x-forwarded-port');
    const port =
      portHeader && !['80', '443'].includes(portHeader) ? `:${portHeader}` : '';

    const legacy = parseLegacySchoolWebsiteHost(clientHost);
    if (legacy) {
      const match = await lookupWebsiteTenant(legacy.slug);
      const tenantSlug = String(match?.tenant_slug || legacy.slug);
      const suffix = normalizeWebsiteUrlSuffix(String(match?.website_url_suffix || 'edu'));
      const publicSubdomain = match?.public_subdomain ?? null;
      const target = buildLegacySchoolWebsiteRedirectUrl(legacy.slug, suffix, clientHost, {
        protocol: `${protocol}:`,
        port,
        tenantSlug,
        publicSubdomain,
      });
      return res.redirect(301, `${target}${req.originalUrl || '/'}`);
    }

    const parsed = parsePublicWebsiteHost(clientHost);
    if (parsed) {
      const match = await lookupWebsiteTenant(parsed.slug);
      if (!match) return next();

      const tenantSlug = String(match.tenant_slug);
      const expectedSuffix = normalizeWebsiteUrlSuffix(String(match.website_url_suffix || 'edu'));
      const expectedPublicSlug = getEffectivePublicWebsiteSlug(tenantSlug, match.public_subdomain);

      if (parsed.slug !== expectedPublicSlug || parsed.suffix !== expectedSuffix) {
        const target = buildSchoolWebsitePublicUrl(tenantSlug, expectedSuffix, {
          host: clientHost,
          protocol: `${protocol}:`,
          port,
          publicSubdomain: match.public_subdomain,
        });
        return res.redirect(301, `${target}${req.originalUrl || '/'}`);
      }
    }

    next();
  } catch (error) {
    console.error('School website host redirect error:', error);
    next();
  }
}
