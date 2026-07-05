import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { query } from '../db/connection.js';
import { resolveTenantBySlug } from '../services/tenantResolver.js';

export type ParentAuthPayload = {
  accountId: number;
  studentId: number;
  tenantId: number;
  impersonatorId?: number | null;
};

export type ParentJwtDecoded = {
  role?: string;
  parentAccountId?: number;
  studentId?: number;
  tenantId?: number;
  impersonatorId?: number | string;
  impersonatorRole?: string | null;
};

export interface ParentAuthRequest extends Request {
  parent?: ParentAuthPayload;
}

/** Validates parent JWT and loads account scoped to tenant_id from the token. */
export async function resolveParentFromToken(
  token: string
): Promise<{ parent: ParentAuthPayload; decoded: ParentJwtDecoded } | null> {
  const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as ParentJwtDecoded;
  if (decoded.role !== 'parent') return null;

  const accountId = parseInt(String(decoded.parentAccountId), 10);
  const jwtTenantId = parseInt(String(decoded.tenantId), 10);
  if (!Number.isInteger(accountId) || accountId <= 0) return null;
  if (!Number.isInteger(jwtTenantId) || jwtTenantId <= 0) return null;

  const row = await query(
    'SELECT id, student_id, tenant_id FROM parent_portal_accounts WHERE id = $1 AND tenant_id = $2 AND is_active = true',
    [accountId, jwtTenantId]
  );
  if (row.rows.length === 0) return null;

  const accountStudentId = Number(row.rows[0].student_id);
  const accountTenantId = Number(row.rows[0].tenant_id);
  if (decoded.studentId != null && Number(decoded.studentId) !== accountStudentId) {
    return null;
  }

  return {
    parent: {
      accountId: Number(row.rows[0].id),
      studentId: accountStudentId,
      tenantId: accountTenantId,
      impersonatorId: decoded.impersonatorId
        ? parseInt(String(decoded.impersonatorId), 10)
        : null,
    },
    decoded,
  };
}

/** When the portal sends X-Tenant-Slug, JWT tenant must match that school. */
export async function validateParentPortalHost(
  req: Request,
  jwtTenantId: number
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const raw = req.headers['x-tenant-slug'];
  if (!raw || typeof raw !== 'string' || !raw.trim()) {
    return { ok: true };
  }
  const tenant = await resolveTenantBySlug(raw.trim());
  if (!tenant) {
    return { ok: false, status: 403, error: 'School portal mismatch' };
  }
  if (Number(tenant.id) !== jwtTenantId) {
    return { ok: false, status: 403, error: 'Session belongs to a different school' };
  }
  return { ok: true };
}

export async function authenticateParent(
  req: ParentAuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const resolved = await resolveParentFromToken(token);
    if (!resolved) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const hostCheck = await validateParentPortalHost(req, resolved.parent.tenantId);
    if (!hostCheck.ok) {
      res.status(hostCheck.status).json({ error: hostCheck.error });
      return;
    }

    req.parent = resolved.parent;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
