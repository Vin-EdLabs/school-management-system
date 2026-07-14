import { detectTenantSlugFromHost } from './tenantHost';
import { isPlatformAdminPath } from '@/constants/platformAdminRoute';

/** True when the user is on the platform super-admin dashboard (not inside a school). */
export function isSuperAdminRoute(pathname: string = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  return isPlatformAdminPath(pathname);
}

/**
 * True when the app is rendering a specific school's dashboard (subdomain or /school/:id),
 * excluding the platform super-admin area.
 */
export function isSchoolTenantView(pathname: string = typeof window !== 'undefined' ? window.location.pathname : ''): boolean {
  if (typeof window === 'undefined') return false;
  if (isSuperAdminRoute(pathname)) return false;
  if (detectTenantSlugFromHost()) return true;
  if (/^\/school\/\d+(\/|$)/i.test(pathname)) return true;
  return false;
}

export function isSuperAdminInSchoolContext(userRole: string | undefined): boolean {
  return userRole === 'super-admin' && isSchoolTenantView();
}

export function isPlatformSuperAdminRole(userRole: string | undefined): boolean {
  return userRole === 'super-admin' && !isSchoolTenantView();
}

/** School staff dashboard (primary admin layout), including platform super-admin inside a school. */
export function shouldUseAdministratorDashboard(userRole: string | undefined): boolean {
  return userRole === 'administrator' || userRole === 'super-admin';
}
