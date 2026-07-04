import type { Request } from 'express';
import { resolveTenantById, resolveTenantBySlug } from '../services/tenantResolver.js';
import { getTenantSlugFromHost, resolveClientHost } from './tenantHost.js';

/** Resolve the tenant id implied by this HTTP request (header, body, query, or subdomain). */
export async function resolveRequestTenantId(req: Request): Promise<number | null> {
  const body = req.body as { tenantId?: unknown; subdomain?: unknown } | undefined;

  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;
  if (headerTenantId) {
    const id = parseInt(String(headerTenantId), 10);
    if (!Number.isNaN(id)) {
      const tenant = await resolveTenantById(id);
      if (tenant) return tenant.id;
    }
  }

  const bodyTenantId = body?.tenantId;
  if (bodyTenantId !== undefined && bodyTenantId !== null && bodyTenantId !== '') {
    const id = parseInt(String(bodyTenantId), 10);
    if (!Number.isNaN(id)) {
      const tenant = await resolveTenantById(id);
      if (tenant) return tenant.id;
    }
  }

  const queryTenantId = req.query.tenantId as string | undefined;
  if (queryTenantId) {
    const id = parseInt(String(queryTenantId), 10);
    if (!Number.isNaN(id)) {
      const tenant = await resolveTenantById(id);
      if (tenant) return tenant.id;
    }
  }

  const headerSlug = req.headers['x-tenant-slug'] as string | undefined;
  const bodySlug = body?.subdomain ? String(body.subdomain) : '';
  const querySlug = req.query.slug as string | undefined;
  for (const slug of [headerSlug, bodySlug, querySlug]) {
    if (slug) {
      const tenant = await resolveTenantBySlug(slug);
      if (tenant) return tenant.id;
    }
  }

  const slugFromHost = getTenantSlugFromHost(resolveClientHost(req));
  if (slugFromHost) {
    const tenant = await resolveTenantBySlug(slugFromHost);
    if (tenant) return tenant.id;
  }

  return null;
}
