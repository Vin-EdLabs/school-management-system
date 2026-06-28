import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db/connection.js';
import { buildAuditContextFromAuth, enrichImpersonatorTenant, runWithAuditContext } from './auditContext.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    tenantId: number | null;
    username: string;
    role: string;
    fullName: string | null;
    isPrimaryAdmin?: boolean;
    teacherId?: string | null;
    otherStaffId?: number | null;
  };
  /** Real admin when JWT is an impersonation token */
  impersonator?: {
    id: number;
    role: string;
    tenantId?: number | null;
    username?: string;
    fullName?: string | null;
  };
}

const normalizeRole = (role: string | null | undefined): string => {
  const r = String(role || '').toLowerCase().trim();
  if (r === 'superadmin') return 'super-admin';
  if (r === 'admin') return 'administrator';
  return r;
};

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    if (decoded.impersonatorId) {
      const impRes = await query(
        `SELECT u.id, u.username, u.role, u.tenant_id, COALESCE(u.full_name, u.username) AS full_name
         FROM users u WHERE u.id = $1 AND COALESCE(u.is_active, true) = true`,
        [decoded.impersonatorId]
      );
      if (impRes.rows.length > 0) {
        const imp = impRes.rows[0];
        req.impersonator = {
          id: imp.id,
          role: normalizeRole(imp.role),
          tenantId: imp.tenant_id ?? null,
          username: imp.username,
          fullName: imp.full_name,
        };
      } else if (decoded.impersonatorRole) {
        req.impersonator = {
          id: parseInt(String(decoded.impersonatorId), 10),
          role: normalizeRole(decoded.impersonatorRole),
          tenantId: null,
          username: undefined,
          fullName: undefined,
        };
      }
    }
    
    // Verify user still exists (support both modern and legacy schemas)
    const attempts: Array<{ sql: string; params: any[] }> = [
      {
        sql: `SELECT u.id, u.tenant_id, u.username, u.role, u.is_primary_admin, u.teacher_id, u.other_staff_id,
                     COALESCE(t.full_name, s.full_name, u.full_name, u.username) as full_name
              FROM users u
              LEFT JOIN teachers t ON u.teacher_id::text = t.id::text AND t.tenant_id = u.tenant_id
              LEFT JOIN other_staff s ON u.other_staff_id = s.id AND s.tenant_id = u.tenant_id
              WHERE u.id = $1 AND u.is_active = true`,
        params: [decoded.userId]
      },
      {
        sql: `SELECT u.id, u.tenant_id, u.username, u.role, u.is_primary_admin, u.teacher_id,
                     NULL::integer as other_staff_id, u.username as full_name
              FROM users u
              WHERE u.id = $1 AND COALESCE(u.is_active, true) = true`,
        params: [decoded.userId]
      },
      {
        sql: `SELECT u.id, NULL::integer as tenant_id, u.username, u.role,
                     false as is_primary_admin, NULL::text as teacher_id,
                     NULL::integer as other_staff_id, u.username as full_name
              FROM users u
              WHERE u.id = $1 AND COALESCE(u.is_active, true) = true`,
        params: [decoded.userId]
      }
    ];

    let result: any = { rows: [] };
    for (const attempt of attempts) {
      try {
        result = await query(attempt.sql, attempt.params);
        if (result.rows.length > 0) break;
      } catch {
        continue;
      }
    }
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    const row = result.rows[0];
    req.user = {
      id: row.id,
      tenantId: row.tenant_id,
      username: row.username,
      fullName: row.full_name,
      role: normalizeRole(row.role),
      isPrimaryAdmin: row.is_primary_admin === true,
      teacherId: row.teacher_id ? String(row.teacher_id) : null,
      otherStaffId: row.other_staff_id || null,
    };

    const ctx = buildAuditContextFromAuth(req);
    if (ctx.impersonator) {
      ctx.impersonator = await enrichImpersonatorTenant(ctx.impersonator, query);
    }
    runWithAuditContext(ctx, () => next());
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const allowed = roles.map(normalizeRole);
    const current = normalizeRole(req.user.role);
    if (!allowed.includes(current)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
  };
};

export const requirePrimaryAdminOrSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const role = normalizeRole(req.user.role);
  if (role === 'super-admin') return next();
  if (role === 'administrator' && req.user.isPrimaryAdmin) return next();
  return res.status(403).json({ error: 'Primary admin or super admin required' });
};

export const requireTenant = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (normalizeRole(req.user.role) === 'super-admin') {
    return next();
  }
  
  if (!req.user.tenantId) {
    return res.status(403).json({ error: 'No tenant assigned' });
  }
  
  next();
};

export const validateTenantAccess = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (normalizeRole(req.user.role) === 'super-admin') return next();
  const requestedTenantId = parseInt(req.query.tenantId as string) || req.user.tenantId;
  if (req.user.tenantId !== requestedTenantId) {
    return res.status(403).json({ error: 'Cross-tenant access denied' });
  }
  next();
};
