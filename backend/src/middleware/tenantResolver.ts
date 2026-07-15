/**
 * Tenant Resolver Middleware
 * Resolves tenant from: X-Tenant-Id, X-Tenant-Slug, query param, or host subdomain
 * Must run early - before auth for public routes
 */
import { Request, Response, NextFunction } from 'express';
import { resolveTenantById, resolveTenantBySlug, resolveTenantByWebsiteSubdomain, TenantInfo } from '../services/tenantResolver.js';
import { getTenantSlugFromHost, resolveClientHost } from '../utils/tenantHost.js';
import { getSchoolWebsiteSubdomainFromHost } from '../utils/schoolWebsiteHost.js';

export interface TenantRequest extends Request {
  tenant?: TenantInfo | null;
  tenantId?: number | null;
}

export async function resolveTenant(
  req: TenantRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let tenant: TenantInfo | null = null;

    // 1. Header: X-Tenant-Id (numeric)
    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) {
      const id = parseInt(headerTenantId, 10);
      if (!isNaN(id)) tenant = await resolveTenantById(id);
    }

    // 2. Header: X-Tenant-Slug
    if (!tenant) {
      const headerSlug = req.headers['x-tenant-slug'] as string;
      if (headerSlug) tenant = await resolveTenantBySlug(headerSlug);
    }

    // 3. Query param: tenantId or slug
    if (!tenant) {
      const queryTenantId = req.query.tenantId as string;
      const querySlug = req.query.slug as string;
      if (queryTenantId) {
        const id = parseInt(queryTenantId, 10);
        if (!isNaN(id)) tenant = await resolveTenantById(id);
      }
      if (!tenant && querySlug) tenant = await resolveTenantBySlug(querySlug);
    }

    // 4. Public school website host: {subdomain}.edu.scholarnerve.com
    if (!tenant) {
      const websiteSubdomain = getSchoolWebsiteSubdomainFromHost(resolveClientHost(req));
      if (websiteSubdomain) {
        tenant = await resolveTenantByWebsiteSubdomain(websiteSubdomain);
      }
    }

    // 5. Portal subdomain: school1.scholarnerve.com
    if (!tenant) {
      const slugFromHost = getTenantSlugFromHost(resolveClientHost(req));
      if (slugFromHost) {
        tenant = await resolveTenantBySlug(slugFromHost);
      }
    }

    req.tenant = tenant;
    req.tenantId = tenant?.id ?? null;
    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    req.tenant = null;
    req.tenantId = null;
    next();
  }
}
