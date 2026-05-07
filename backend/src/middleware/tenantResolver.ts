/**
 * Tenant Resolver Middleware
 * Resolves tenant from: X-Tenant-Id, X-Tenant-Slug, query param, or host subdomain
 * Must run early - before auth for public routes
 */
import { Request, Response, NextFunction } from 'express';
import { resolveTenantById, resolveTenantBySlug, TenantInfo } from '../services/tenantResolver.js';

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

    // 4. Subdomain: school1.scholarnerve.com
    if (!tenant && req.hostname) {
      const host = req.hostname.toLowerCase();
      const parts = host.split('.');
      
      // Basic check: at least 2 parts
      if (parts.length >= 2) {
        const subdomain = parts[0];
        const reserved = ['www', 'api', 'app', 'admin', 'dev', 'staging', 'scholarnerve', 'portal'];
        
        // Only try resolving if it's not a reserved subdomain
        if (!reserved.includes(subdomain)) {
          // If on onrender.com, we expect 4 parts for a tenant (tenant.app.onrender.com)
          if (host.endsWith('.onrender.com')) {
            if (parts.length >= 4) {
              tenant = await resolveTenantBySlug(subdomain);
            }
          } 
          // For custom domains (e.g. tenant.scholarnerve.com), we expect 3 parts
          else if (parts.length >= 3) {
            tenant = await resolveTenantBySlug(subdomain);
          }
        }
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
