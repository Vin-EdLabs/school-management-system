import { apiService } from '../services/api';
import { getTenantSchoolUrl } from './tenantHost';
import { isSchoolTenantView, isSuperAdminRoute } from './schoolAdminView';

export const ADMIN_BACKUP_KEY = 'impersonation_admin_backup';
export const IMPERSONATION_META_KEY = 'impersonation_meta';
export const IMPERSONATION_GO_MODULE_KEY = 'impersonation_go_module';
export const ADMIN_ELIGIBLE_KEY = 'impersonation_admin_eligible';
export const STAFF_IMPERSONATION_TOKEN_KEY = 'impersonation_staff_token';
/** Set before same-origin /portal/:id redirect so LegacyPortalRedirect skips cross-subdomain hop */
export const PARENT_IMPERSONATE_HANDOFF_KEY = 'parent_impersonate_handoff';
/** Set before /school/:id redirect so tenant lookup is skipped on arrival */
export const STAFF_IMPERSONATE_HANDOFF_KEY = 'staff_impersonate_handoff';
export const IMPERSONATION_TRANSITION_CHANGED_EVENT = 'impersonation-transition-changed';
export const IMPERSONATION_TRANSITION_MSG_KEY = 'impersonation_transition_msg';
export const IMPERSONATION_TRANSITION_PHASE_KEY = 'impersonation_transition_phase';
export const IMPERSONATION_TRANSITION_STARTED_KEY = 'impersonation_transition_started';

export type AdminBackup = {
  token: string;
  user: Record<string, unknown>;
  schoolId?: number | null;
  schoolSlug?: string | null;
  returnModule?: string;
  /** True when impersonation started from /super-admin platform dashboard */
  startedFromSuperAdmin?: boolean;
};

export type ImpersonationMeta = {
  active?: boolean;
  targetName?: string;
  targetRole?: string;
  schoolName?: string;
  mode?: 'staff' | 'parent';
};

export type ImpersonationRestoreResult = {
  token: string;
  user: Record<string, unknown>;
  backup: AdminBackup | null;
  returnModule: string;
};

/** Minimum duration the transition card stays visible (background work may finish sooner). */
export const IMPERSONATION_TRANSITION_MS = 3000;
/** @deprecated Use IMPERSONATION_TRANSITION_MS — card always shows at least 3s */
export const STAFF_IMPERSONATION_TRANSITION_MS = IMPERSONATION_TRANSITION_MS;
/** @deprecated Use IMPERSONATION_TRANSITION_MS — card always shows at least 3s */
export const PARENT_IMPERSONATION_TRANSITION_MS = IMPERSONATION_TRANSITION_MS;
export const IMPERSONATION_TRANSITION_DURATION_KEY = 'impersonation_transition_duration_ms';

export function delay(ms = IMPERSONATION_TRANSITION_MS): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function ensureMinimumTransition(
  startedAt: number,
  minMs = IMPERSONATION_TRANSITION_MS
): Promise<void> {
  const remaining = minMs - (Date.now() - startedAt);
  if (remaining > 0) await delay(remaining);
}

/** Run background work in parallel with the minimum card display time. */
export async function runWithTransitionMinimum<T>(
  startedAt: number,
  work: () => Promise<T>,
  minMs = IMPERSONATION_TRANSITION_MS
): Promise<T> {
  const [result] = await Promise.all([work(), ensureMinimumTransition(startedAt, minMs)]);
  return result;
}

export type ImpersonationTransitionState = {
  message: string;
  phase: 'enter' | 'exit';
  startedAt: number;
  durationMs: number;
};

export function beginImpersonationTransition(
  message: string,
  phase: 'enter' | 'exit' = 'enter',
  durationMs = IMPERSONATION_TRANSITION_MS
) {
  sessionStorage.setItem(IMPERSONATION_TRANSITION_MSG_KEY, message);
  sessionStorage.setItem(IMPERSONATION_TRANSITION_PHASE_KEY, phase);
  sessionStorage.setItem(IMPERSONATION_TRANSITION_STARTED_KEY, String(Date.now()));
  sessionStorage.setItem(IMPERSONATION_TRANSITION_DURATION_KEY, String(durationMs));
  window.dispatchEvent(new CustomEvent(IMPERSONATION_TRANSITION_CHANGED_EVENT));
}

export function updateImpersonationTransitionMessage(message: string) {
  sessionStorage.setItem(IMPERSONATION_TRANSITION_MSG_KEY, message);
  window.dispatchEvent(new CustomEvent(IMPERSONATION_TRANSITION_CHANGED_EVENT));
}

export function getImpersonationTransitionDuration(): number {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_TRANSITION_DURATION_KEY);
    const parsed = raw ? parseInt(raw, 10) : IMPERSONATION_TRANSITION_MS;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : IMPERSONATION_TRANSITION_MS;
  } catch {
    return IMPERSONATION_TRANSITION_MS;
  }
}

export function readImpersonationTransition(): ImpersonationTransitionState | null {
  try {
    const message = sessionStorage.getItem(IMPERSONATION_TRANSITION_MSG_KEY);
    const phase = sessionStorage.getItem(IMPERSONATION_TRANSITION_PHASE_KEY) as 'enter' | 'exit' | null;
    const startedRaw = sessionStorage.getItem(IMPERSONATION_TRANSITION_STARTED_KEY);
    if (!message || !phase || !startedRaw) return null;
    const startedAt = parseInt(startedRaw, 10);
    if (!Number.isFinite(startedAt)) return null;
    return { message, phase, startedAt, durationMs: getImpersonationTransitionDuration() };
  } catch {
    return null;
  }
}

export function clearImpersonationTransition() {
  sessionStorage.removeItem(IMPERSONATION_TRANSITION_MSG_KEY);
  sessionStorage.removeItem(IMPERSONATION_TRANSITION_PHASE_KEY);
  sessionStorage.removeItem(IMPERSONATION_TRANSITION_STARTED_KEY);
  sessionStorage.removeItem(IMPERSONATION_TRANSITION_DURATION_KEY);
  window.dispatchEvent(new CustomEvent(IMPERSONATION_TRANSITION_CHANGED_EVENT));
}

export function isParentImpersonationTransitionReady(tenantId: number): boolean {
  const active = readImpersonationTransition();
  if (!active) return true;
  const elapsed = Date.now() - active.startedAt;
  if (elapsed < active.durationMs) return false;
  const token = localStorage.getItem(`parent_token_${tenantId}`);
  const student = localStorage.getItem(`parent_student_${tenantId}`);
  return !!(token && student);
}

/** Staff impersonation (teacher, finance, administrator, etc.) — ready when session exists and we're on the school app. */
export function isStaffImpersonationTransitionReady(): boolean {
  const active = readImpersonationTransition();
  if (!active) return true;

  const elapsed = Date.now() - active.startedAt;
  if (elapsed < active.durationMs) return false;

  const msg = active.message.toLowerCase();
  const isStaffEnter = active.phase === 'enter' && msg.includes('switching');
  const isStaffExit = active.phase === 'exit';

  if (!isStaffEnter && !isStaffExit) return true;

  const token = localStorage.getItem('authToken');
  const userRaw = localStorage.getItem('rosaGardensUser');
  if (!token || !userRaw) return false;

  if (isStaffExit) {
    return isSuperAdminRoute() || isSchoolTenantView();
  }

  if (isStaffEnter) {
    if (!tokenHasImpersonator(token)) return true;
    return isSchoolTenantView();
  }

  return true;
}

export function isStaffImpersonationActive(): boolean {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_META_KEY);
    if (!raw) return false;
    const meta = JSON.parse(raw) as ImpersonationMeta;
    return meta.active === true && meta.mode !== 'parent';
  } catch {
    return false;
  }
}

/** Same-origin parent portal URL (keeps impersonation tokens in localStorage). */
export function getApexParentPortalUrl(tenantId: number): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/portal/${tenantId}`;
}

/** Persist parent-portal impersonation token and preload student profile for dashboard. */
export async function bootstrapParentImpersonationSession(
  tenantId: number,
  token: string,
  meta?: Partial<ImpersonationMeta>,
  opts?: { sameOriginHandoff?: boolean }
): Promise<boolean> {
  saveParentImpersonationMeta(tenantId, { ...meta, active: true, mode: 'parent' });
  localStorage.setItem(`parent_token_${tenantId}`, token);
  localStorage.setItem(`parent_impersonation_${tenantId}`, '1');
  if (opts?.sameOriginHandoff) {
    sessionStorage.setItem(PARENT_IMPERSONATE_HANDOFF_KEY, String(tenantId));
  }

  try {
    const res = await fetch(`${apiService.getBaseUrl()}/parent/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (!res.ok) return false;
    const me = (await res.json()) as Record<string, unknown>;
    const studentInfo = { ...me, must_change_password: false };
    localStorage.setItem(`parent_student_${tenantId}`, JSON.stringify(studentInfo));
    window.dispatchEvent(
      new CustomEvent('parent-impersonation-session-ready', { detail: { tenantId } })
    );
    return true;
  } catch {
    return false;
  }
}

export function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function tokenHasImpersonator(token: string | null | undefined): boolean {
  if (!token) return false;
  const payload = parseJwtPayload(token);
  return payload?.impersonatorId != null && payload.impersonatorId !== '';
}

export function saveStaffImpersonationToken(token: string) {
  sessionStorage.setItem(STAFF_IMPERSONATION_TOKEN_KEY, token);
}

export function getStaffImpersonationToken(): string | null {
  return sessionStorage.getItem(STAFF_IMPERSONATION_TOKEN_KEY) || localStorage.getItem('authToken');
}

export function clearStaffImpersonationToken() {
  sessionStorage.removeItem(STAFF_IMPERSONATION_TOKEN_KEY);
}

export function defaultModuleForRole(role?: string | null): string {
  switch (role) {
    case 'teacher':
    case 'staff':
      return 'teacher-dashboard';
    case 'finance':
      return 'financial-dashboard';
    case 'headmaster':
      return 'headmaster-dashboard';
    case 'driver':
      return 'transport-overview';
    default:
      return 'dashboard';
  }
}

export function readAdminBackup(): AdminBackup | null {
  try {
    const raw =
      sessionStorage.getItem(ADMIN_BACKUP_KEY) || localStorage.getItem(ADMIN_BACKUP_KEY);
    return raw ? (JSON.parse(raw) as AdminBackup) : null;
  } catch {
    return null;
  }
}

export function clearAdminBackup() {
  sessionStorage.removeItem(ADMIN_BACKUP_KEY);
  localStorage.removeItem(ADMIN_BACKUP_KEY);
}

export function saveAdminBackup(backup: AdminBackup) {
  const json = JSON.stringify(backup);
  sessionStorage.setItem(ADMIN_BACKUP_KEY, json);
  localStorage.setItem(ADMIN_BACKUP_KEY, json);
}

export function parentImpersonationActive(tenantId: number): boolean {
  return localStorage.getItem(`parent_impersonation_${tenantId}`) === '1';
}

export function loadParentImpersonationMeta(tenantId: number): ImpersonationMeta {
  try {
    const local = localStorage.getItem(`parent_impersonation_meta_${tenantId}`);
    if (local) return JSON.parse(local) as ImpersonationMeta;
    const session = sessionStorage.getItem(IMPERSONATION_META_KEY);
    if (session) return JSON.parse(session) as ImpersonationMeta;
  } catch {
    // ignore
  }
  return {};
}

export function saveParentImpersonationMeta(tenantId: number, meta: ImpersonationMeta) {
  const payload = { ...meta, active: true, mode: 'parent' as const };
  sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(payload));
  localStorage.setItem(`parent_impersonation_meta_${tenantId}`, JSON.stringify(payload));
}

export function clearParentImpersonationLocal(tenantId: number) {
  localStorage.removeItem(`parent_token_${tenantId}`);
  localStorage.removeItem(`parent_impersonation_${tenantId}`);
  localStorage.removeItem(`parent_impersonation_meta_${tenantId}`);
  sessionStorage.removeItem(IMPERSONATION_META_KEY);
}

export function restoreAdminSession(
  token: string,
  user: Record<string, unknown>,
  backup?: AdminBackup | null
) {
  const merged = backup
    ? {
        ...backup.user,
        ...user,
        isPrimaryAdmin: user.isPrimaryAdmin === true || backup.user.isPrimaryAdmin === true,
      }
    : user;
  localStorage.setItem('authToken', token);
  localStorage.setItem('rosaGardensUser', JSON.stringify(merged));
  if (backup?.schoolId) {
    localStorage.setItem('currentSchoolId', String(backup.schoolId));
  }
  clearStaffImpersonationToken();
  return merged;
}

export function prepareReturnToAdminDashboard(backup: AdminBackup | null) {
  const returnModule = backup?.returnModule || 'dashboard';
  sessionStorage.setItem(IMPERSONATION_GO_MODULE_KEY, returnModule);
  return returnModule;
}

/** Where to send the admin after exiting impersonation (never apex `/` for super-admin). */
export function resolvePostImpersonationPath(
  user: Record<string, unknown>,
  backup: AdminBackup | null
): string {
  const role = String(user.role || '').toLowerCase();
  if (role === 'super-admin' || backup?.startedFromSuperAdmin || backup?.returnModule === 'super-admin') {
    return '/super-admin';
  }
  const schoolPath = getTenantSchoolUrl(backup?.schoolSlug ?? null, backup?.schoolId ?? undefined);
  return schoolPath || '/';
}

export function applyPostExitTenantContext(user: Record<string, unknown>, backup: AdminBackup | null) {
  const role = String(user.role || '').toLowerCase();
  if (role === 'super-admin') {
    apiService.clearTenantContext();
    return;
  }
  if (backup?.schoolId) {
    apiService.setTenantContext(backup.schoolId);
  }
}

/** Hard redirect only when SPA navigation cannot reach the staff app (cross-origin). */
export function hardRedirectToAdminDashboard(backup: AdminBackup | null) {
  prepareReturnToAdminDashboard(backup);
  window.location.href = getTenantSchoolUrl(backup?.schoolSlug ?? null, backup?.schoolId ?? undefined);
}

/** Exit impersonation using staff or parent JWT — returns admin token payload */
export async function callImpersonationExit(authToken: string) {
  const res = await fetch(`${apiService.getBaseUrl()}/auth/impersonate/exit`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to exit impersonation');
  }
  return data as { token: string; user: Record<string, unknown> };
}

/** Exit staff impersonation — uses dedicated token; falls back to admin backup */
export async function exitStaffImpersonation(): Promise<ImpersonationRestoreResult> {
  const backup = readAdminBackup();
  const exitToken = getStaffImpersonationToken();

  if (exitToken && tokenHasImpersonator(exitToken)) {
    const data = await callImpersonationExit(exitToken);
    clearStaffImpersonationToken();
    clearAdminBackup();
    sessionStorage.removeItem(IMPERSONATION_META_KEY);
    return {
      token: data.token,
      user: data.user,
      backup,
      returnModule: backup?.returnModule || 'dashboard',
    };
  }

  if (backup?.token) {
    clearStaffImpersonationToken();
    clearAdminBackup();
    sessionStorage.removeItem(IMPERSONATION_META_KEY);
    return {
      token: backup.token,
      user: backup.user,
      backup,
      returnModule: backup.returnModule || 'dashboard',
    };
  }

  throw new Error('Not in impersonation mode');
}

/** Exit parent-portal impersonation — returns admin session for soft navigation */
export async function exitParentImpersonation(tenantId: number): Promise<ImpersonationRestoreResult> {
  const backup = readAdminBackup();
  const parentToken = localStorage.getItem(`parent_token_${tenantId}`);

  if (parentToken && tokenHasImpersonator(parentToken)) {
    const data = await callImpersonationExit(parentToken);
    clearParentImpersonationLocal(tenantId);
    clearAdminBackup();
    return {
      token: data.token,
      user: data.user,
      backup,
      returnModule: backup?.returnModule || 'dashboard',
    };
  }

  if (backup?.token) {
    clearParentImpersonationLocal(tenantId);
    clearAdminBackup();
    return {
      token: backup.token,
      user: backup.user,
      backup,
      returnModule: backup.returnModule || 'dashboard',
    };
  }

  throw new Error('Not in impersonation mode');
}
