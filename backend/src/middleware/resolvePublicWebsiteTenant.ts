/**
 * Resolve tenant for public school website API routes.
 * Hostname (public slug + suffix) takes priority over X-Tenant-Slug so custom
 * public slugs work and old portal slugs can redirect to the canonical URL.
 */
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import {
  resolveTenantByWebsiteHost,
  resolveTenantByWebsiteSubdomain,
  type TenantInfo,
} from '../services/tenantResolver.js';
import { resolveClientHost } from '../utils/tenantHost.js';
import {
  buildSchoolWebsitePublicUrl,
  getEffectivePublicWebsiteSlug,
  normalizeWebsiteUrlSuffix,
  parseLegacySchoolWebsiteHost,
  parsePublicWebsiteHost,
} from '../utils/schoolWebsiteHost.js';
import type { TenantRequest } from './tenantResolver.js';

async function getCanonicalWebsiteMeta(tenantId: number) {
  const row = await query(
    `SELECT t.slug AS tenant_slug,
            sw.public_subdomain,
            COALESCE(NULLIF(TRIM(sw.website_url_suffix), ''), 'edu') AS website_url_suffix
     FROM tenants t
     LEFT JOIN school_websites sw ON sw.tenant_id = t.id
     WHERE t.id = $1
     LIMIT 1`,
    [tenantId]
  );
  const data = row.rows[0];
  if (!data) return null;
  const tenantSlug = String(data.tenant_slug || '');
  const publicSubdomain = (data.public_subdomain as string | null) || null;
  const suffix = normalizeWebsiteUrlSuffix(String(data.website_url_suffix || 'edu'));
  const publicSlug = getEffectivePublicWebsiteSlug(tenantSlug, publicSubdomain);
  return { tenantSlug, publicSubdomain, suffix, publicSlug };
}

function buildPublicWebsiteApiRedirect(req: Request, clientHost: string, meta: Awaited<ReturnType<typeof getCanonicalWebsiteMeta>>) {
  if (!meta) return null;
  const origin = buildSchoolWebsitePublicUrl(meta.tenantSlug, meta.suffix, {
    host: clientHost,
    publicSubdomain: meta.publicSubdomain,
  });
  const base = new URL(origin);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === 'string') params.set(key, value);
  }
  params.set('host', base.hostname);
  const path = `/api/public-website${req.path === '/' ? '' : req.path}`;
  return `${base.origin}${path}?${params.toString()}`;
}

function buildPublicWebsitePageRedirect(clientHost: string, meta: NonNullable<Awaited<ReturnType<typeof getCanonicalWebsiteMeta>>>, req: Request) {
  const origin = buildSchoolWebsitePublicUrl(meta.tenantSlug, meta.suffix, {
    host: clientHost,
    publicSubdomain: meta.publicSubdomain,
  });
  const base = new URL(origin);
  const path = req.path && req.path !== '/' ? req.path : '/';
  const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return `${base.origin}${path}${qs}`;
}

async function attachTenant(
  req: TenantRequest,
  res: Response,
  tenant: TenantInfo,
  clientHost: string,
  parsed: { slug: string; suffix: string } | null
): Promise<boolean> {
  const meta = await getCanonicalWebsiteMeta(tenant.id);
  if (meta && parsed) {
    const slugMismatch = parsed.slug !== meta.publicSlug;
    const suffixMismatch = parsed.suffix !== meta.suffix;
    if (slugMismatch || suffixMismatch) {
      if (req.method === 'GET') {
        const wantsHtml = String(req.headers.accept || '').includes('text/html');
        const target = wantsHtml
          ? buildPublicWebsitePageRedirect(clientHost, meta, req)
          : buildPublicWebsiteApiRedirect(req, clientHost, meta);
        if (target) {
          res.redirect(301, target);
          return false;
        }
      }
    }
  }
  req.tenant = tenant;
  req.tenantId = tenant.id;
  return true;
}

export async function resolvePublicWebsiteTenant(req: TenantRequest, res: Response, next: NextFunction) {
  try {
    const clientHost = resolveClientHost(req);

    const parsed = parsePublicWebsiteHost(clientHost);
    if (parsed) {
      let tenant = await resolveTenantByWebsiteHost(parsed.slug, parsed.suffix);
      if (!tenant) {
        tenant = await resolveTenantByWebsiteSubdomain(parsed.slug);
      }
      if (tenant) {
        const ok = await attachTenant(req, res, tenant, clientHost, parsed);
        if (!ok) return;
        return next();
      }
      return res.status(404).json({ error: 'School not found' });
    }

    const legacy = parseLegacySchoolWebsiteHost(clientHost);
    if (legacy) {
      const tenant = await resolveTenantByWebsiteSubdomain(legacy.slug);
      if (tenant) {
        const ok = await attachTenant(req, res, tenant, clientHost, null);
        if (!ok) return;
        return next();
      }
    }

    const headerSlug = String(req.headers['x-tenant-slug'] || '').trim();
    if (headerSlug) {
      const tenant = await resolveTenantByWebsiteSubdomain(headerSlug);
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        return next();
      }
    }

    const querySlug = String(req.query.slug || '').trim();
    if (querySlug) {
      const tenant = await resolveTenantByWebsiteSubdomain(querySlug);
      if (tenant) {
        req.tenant = tenant;
        req.tenantId = tenant.id;
        return next();
      }
    }

    req.tenant = null;
    req.tenantId = null;
    next();
  } catch (error) {
    console.error('Public website tenant resolution error:', error);
    req.tenant = null;
    req.tenantId = null;
    next();
  }
}
