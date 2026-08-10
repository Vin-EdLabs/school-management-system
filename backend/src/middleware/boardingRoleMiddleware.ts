import { Response, NextFunction } from 'express';
import { AuthRequest, requireRole } from './auth.js';

export const BOARDING_ADMIN_ROLES = ['super-admin', 'administrator'] as const;
export const BOARDING_MATRON_ROLES = ['matron', 'house-master'] as const;
export const BOARDING_STAFF_ROLES = [...BOARDING_MATRON_ROLES, ...BOARDING_ADMIN_ROLES] as const;
export const BOARDING_HOUSEMASTER_PLUS = ['house-master', ...BOARDING_ADMIN_ROLES] as const;
export const BOARDING_COMPLAINT_RESOLVER_ROLES = ['super-admin', 'administrator', 'headmaster'] as const;
export const BOARDING_COMPLAINT_FILER_ROLES = ['matron', 'house-master'] as const;

export function isBoardingComplaintResolver(role: string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return (BOARDING_COMPLAINT_RESOLVER_ROLES as readonly string[]).includes(r);
}

export function isBoardingComplaintFiler(role: string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return (BOARDING_COMPLAINT_FILER_ROLES as readonly string[]).includes(r);
}

export function isBoardingStaffRole(role: string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return (BOARDING_STAFF_ROLES as readonly string[]).includes(r);
}

export function isBoardingOnlyRole(role: string | undefined): boolean {
  const r = String(role || '').toLowerCase();
  return (BOARDING_MATRON_ROLES as readonly string[]).includes(r);
}

/** Matron, house master, admin, super-admin */
export const requireBoardingStaff = requireRole(...BOARDING_STAFF_ROLES);

/** House master + admins only */
export const requireHouseMasterPlus = requireRole(...BOARDING_HOUSEMASTER_PLUS);

/** Admin + headmaster — receive and resolve boarding complaints */
export const requireBoardingComplaintResolver = requireRole(...BOARDING_COMPLAINT_RESOLVER_ROLES);

/** Admin only (dorms, rooms, beds, enrollments, rollover) */
export const requireBoardingAdmin = requireRole(...BOARDING_ADMIN_ROLES);

/** Block matron/house master from non-boarding API sections when used as guard */
export function requireNonBoardingStaff(req: AuthRequest, res: Response, next: NextFunction): void {
  if (isBoardingOnlyRole(req.user?.role)) {
    res.status(403).json({ error: 'Access restricted to boarding module', code: 'BOARDING_STAFF_ONLY' });
    return;
  }
  next();
}
