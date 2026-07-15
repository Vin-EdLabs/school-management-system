import { parseJwtPayload } from '@/utils/impersonationHelpers';

/** Tenant id embedded in a parent JWT (must match the portal being viewed). */
export function getParentTokenTenantId(token: string | null | undefined): number | null {
  if (!token) return null;
  const payload = parseJwtPayload(token);
  const tid = parseInt(String(payload?.tenantId), 10);
  return Number.isInteger(tid) && tid > 0 ? tid : null;
}

export function isParentTokenForTenant(token: string | null | undefined, tenantId: number): boolean {
  const tokenTenant = getParentTokenTenantId(token);
  return tokenTenant != null && tokenTenant === tenantId;
}

export function readParentToken(tenantId: number): string | null {
  const token = localStorage.getItem(`parent_token_${tenantId}`);
  if (!token) return null;
  if (!isParentTokenForTenant(token, tenantId)) {
    clearParentTenantSession(tenantId);
    return null;
  }
  return token;
}

export function clearParentTenantSession(tenantId: number): void {
  localStorage.removeItem(`parent_token_${tenantId}`);
  localStorage.removeItem(`parent_student_${tenantId}`);
  localStorage.removeItem(`parent_accounts_${tenantId}`);
  localStorage.removeItem(`parent_fcm_token_${tenantId}`);
}

export function studentBelongsToTenant(
  student: { tenant_id?: number | null } | null | undefined,
  tenantId: number
): boolean {
  if (!student) return false;
  const studentTenant = Number(student.tenant_id);
  if (!Number.isInteger(studentTenant) || studentTenant <= 0) return false;
  return studentTenant === tenantId;
}
