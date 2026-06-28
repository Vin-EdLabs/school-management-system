import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useSchool } from './SchoolContext';
import { detectTenantSlugFromHost } from '../utils/tenantHost';
import {
  ADMIN_BACKUP_KEY,
  ADMIN_ELIGIBLE_KEY,
  IMPERSONATION_META_KEY,
  IMPERSONATION_GO_MODULE_KEY,
  defaultModuleForRole,
  readAdminBackup,
  saveAdminBackup,
  saveStaffImpersonationToken,
  exitStaffImpersonation,
  prepareReturnToAdminDashboard,
  applyPostExitTenantContext,
  resolvePostImpersonationPath,
  bootstrapParentImpersonationSession,
  tokenHasImpersonator,
  getStaffImpersonationToken,
  beginImpersonationTransition,
  clearImpersonationTransition,
  IMPERSONATION_TRANSITION_MS,
  STAFF_IMPERSONATE_HANDOFF_KEY,
  runWithTransitionMinimum,
  updateImpersonationTransitionMessage,
  type AdminBackup,
  type ImpersonationMeta,
} from '../utils/impersonationHelpers';
import { toast } from '@/hooks/use-toast';

export type ImpersonationInfo = ImpersonationMeta & { active: boolean };

type ImpersonationContextValue = {
  impersonation: ImpersonationInfo;
  isImpersonating: boolean;
  loading: boolean;
  canImpersonate: boolean;
  startStaffImpersonation: (opts: { identifier?: string; targetUserId?: number; tenantId?: number }) => Promise<void>;
  startAutoImpersonation: (identifier: string, tenantId?: number) => Promise<void>;
  startParentImpersonation: (opts: { identifier?: string; studentId?: number; tenantId?: number }) => Promise<void>;
  exitImpersonation: () => Promise<void>;
};

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

function loadMeta(): ImpersonationInfo {
  try {
    const raw = sessionStorage.getItem(IMPERSONATION_META_KEY);
    if (!raw) return { active: false };
    return JSON.parse(raw) as ImpersonationInfo;
  } catch {
    return { active: false };
  }
}

function saveMeta(meta: ImpersonationInfo) {
  if (meta.active) {
    sessionStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));
  } else {
    sessionStorage.removeItem(IMPERSONATION_META_KEY);
  }
}

function backupAdminSession(
  returnModule?: string,
  school?: { id?: number; slug?: string | null } | null
) {
  const token = localStorage.getItem('authToken');
  const userRaw = localStorage.getItem('rosaGardensUser');
  const storedSchoolId = localStorage.getItem('currentSchoolId');
  if (!token || !userRaw) return;
  const startedFromSuperAdmin =
    returnModule === 'super-admin' || window.location.pathname.includes('/super-admin');
  const backup: AdminBackup = {
    token,
    user: JSON.parse(userRaw),
    schoolId: startedFromSuperAdmin ? null : (school?.id ?? (storedSchoolId ? parseInt(storedSchoolId, 10) : null)),
    schoolSlug: startedFromSuperAdmin ? null : (school?.slug ?? null),
    returnModule,
    startedFromSuperAdmin,
  };
  saveAdminBackup(backup);
  sessionStorage.setItem(ADMIN_ELIGIBLE_KEY, '1');
}

async function finishStaffImpersonation(
  token: string,
  user: Record<string, unknown>,
  meta: ImpersonationInfo,
  applyStaffSession: (t: string, u: Record<string, unknown>, m: ImpersonationInfo) => void,
  _navigate: (path: string) => void,
  targetLabel: string,
  _startedAt: number
): Promise<'hard' | 'soft'> {
  saveStaffImpersonationToken(token);
  applyStaffSession(token, user, { ...meta, active: true, mode: 'staff' });
  const tid = user.tenantId != null ? Number(user.tenantId) : null;
  if (tid) {
    apiService.setTenantContext(tid);
    localStorage.setItem('currentSchoolId', String(tid));
  }
  const mod = defaultModuleForRole(String(user.role || ''));
  sessionStorage.setItem(IMPERSONATION_GO_MODULE_KEY, mod);

  const onSuperAdmin = window.location.pathname.includes('/super-admin');
  if (onSuperAdmin && tid) {
    sessionStorage.setItem(STAFF_IMPERSONATE_HANDOFF_KEY, String(tid));
    window.location.href = `/school/${tid}/`;
    return 'hard';
  }

  if (onSuperAdmin && !tid) {
    clearImpersonationTransition();
    toast({
      title: 'Could not open school dashboard',
      description: 'This user has no school assigned.',
      variant: 'destructive',
    });
    return 'soft';
  }

  toast({ title: 'Now viewing as', description: targetLabel });
  return 'soft';
}

async function finishParentImpersonation(
  tenantId: number,
  token: string,
  meta: ImpersonationInfo,
  _schoolSlug: string | null | undefined,
  schoolName: string | undefined,
  navigate: (path: string) => void
): Promise<'hard' | 'soft'> {
  const onSchoolSubdomain = !!detectTenantSlugFromHost();
  const onSuperAdmin = window.location.pathname.includes('/super-admin');
  const useSameOriginPortal = onSuperAdmin || !onSchoolSubdomain;

  await bootstrapParentImpersonationSession(
    tenantId,
    token,
    { ...meta, schoolName, active: true, mode: 'parent' },
    { sameOriginHandoff: useSameOriginPortal }
  );

  if (useSameOriginPortal) {
    window.location.href = `/portal/${tenantId}`;
    return 'hard';
  }

  if (window.location.pathname.includes('/portal')) {
    window.dispatchEvent(
      new CustomEvent('parent-impersonation-session-ready', { detail: { tenantId } })
    );
    return 'soft';
  }

  navigate('/portal');
  return 'soft';
}

export const ImpersonationProvider: React.FC<{ children: React.ReactNode; returnModule?: string }> = ({
  children,
  returnModule = 'dashboard',
}) => {
  const navigate = useNavigate();
  const { user, actsAsPrimaryAdmin, isPlatformSuperAdmin, applySession } = useAuth();
  const { schoolId, school } = useSchool();
  const [impersonation, setImpersonation] = useState<ImpersonationInfo>(() => loadMeta());
  const [loading, setLoading] = useState(false);

  const adminEligible =
    typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_ELIGIBLE_KEY) === '1';

  const isImpersonating = impersonation.active && impersonation.mode !== 'parent';

  const canImpersonate =
    !isImpersonating &&
    !!(actsAsPrimaryAdmin || isPlatformSuperAdmin || adminEligible || user?.role === 'super-admin');

  useEffect(() => {
    if (!user) {
      setImpersonation({ active: false });
      saveMeta({ active: false });
      return;
    }
    const meta = loadMeta();
    if (meta.active && meta.mode === 'staff') {
      const tok = getStaffImpersonationToken();
      if (tok && tokenHasImpersonator(tok)) saveStaffImpersonationToken(tok);
      setImpersonation(meta);
    } else if (!meta.active) {
      setImpersonation({ active: false });
    }
  }, [user]);

  const applyStaffSession = useCallback(
    (token: string, userPayload: Record<string, unknown>, meta: ImpersonationInfo) => {
      saveStaffImpersonationToken(token);
      applySession(token, userPayload);
      setImpersonation(meta);
      saveMeta(meta);
    },
    [applySession]
  );

  const startStaffImpersonation = useCallback(
    async (opts: { identifier?: string; targetUserId?: number; tenantId?: number }) => {
      const startedAt = Date.now();
      beginImpersonationTransition('Switching view…', 'enter', IMPERSONATION_TRANSITION_MS);
      setLoading(true);
      let hardNav = false;
      try {
        backupAdminSession(returnModule, school);
        const navKind = await runWithTransitionMinimum(startedAt, async () => {
          const res = await apiService.post<{
            mode: string;
            token: string;
            user: Record<string, unknown>;
            impersonation: ImpersonationInfo;
          }>('/auth/impersonate/start', {
            ...opts,
            tenantId: opts.tenantId ?? schoolId,
          });
          return finishStaffImpersonation(
            res.token,
            res.user,
            res.impersonation,
            applyStaffSession,
            navigate,
            `${res.impersonation.targetName} · ${res.impersonation.targetRole}`,
            startedAt
          );
        });
        if (navKind === 'hard') hardNav = true;
      } finally {
        if (!hardNav) setLoading(false);
      }
    },
    [applyStaffSession, navigate, returnModule, school, schoolId]
  );

  const startAutoImpersonation = useCallback(
    async (identifier: string, tenantId?: number) => {
      const startedAt = Date.now();
      beginImpersonationTransition('Switching view…', 'enter', IMPERSONATION_TRANSITION_MS);
      setLoading(true);
      let hardNav = false;
      try {
        backupAdminSession(returnModule, school);
        const navKind = await runWithTransitionMinimum(startedAt, async () => {
          const res = await apiService.post<{
            mode: 'staff' | 'parent';
            token: string;
            user?: Record<string, unknown>;
            tenantId?: number;
            schoolSlug?: string;
            schoolName?: string;
            impersonation: ImpersonationInfo;
          }>('/auth/impersonate/start-auto', {
            identifier,
            tenantId: tenantId ?? schoolId,
          });

          if (res.mode === 'parent') {
            const tid = res.tenantId ?? tenantId ?? schoolId;
            if (!tid) throw new Error('School context required');
            updateImpersonationTransitionMessage('Opening parent portal…');
            return finishParentImpersonation(
              tid,
              res.token,
              res.impersonation,
              res.schoolSlug ?? school?.slug ?? null,
              res.schoolName,
              navigate
            );
          }

          if (res.user) {
            return finishStaffImpersonation(
              res.token,
              res.user,
              res.impersonation,
              applyStaffSession,
              navigate,
              String(res.impersonation.targetName),
              startedAt
            );
          }
          throw new Error('User not found');
        });
        if (navKind === 'hard') hardNav = true;
      } finally {
        if (!hardNav) setLoading(false);
      }
    },
    [applyStaffSession, navigate, returnModule, school, schoolId]
  );

  const startParentImpersonation = useCallback(
    async (opts: { identifier?: string; studentId?: number; tenantId?: number }) => {
      const startedAt = Date.now();
      beginImpersonationTransition('Opening parent portal…', 'enter', IMPERSONATION_TRANSITION_MS);
      setLoading(true);
      let hardNav = false;
      try {
        backupAdminSession(returnModule, school);
        const navKind = await runWithTransitionMinimum(startedAt, async () => {
          const res = await apiService.post<{
            token: string;
            tenantId: number;
            schoolSlug?: string;
            schoolName?: string;
            impersonation: ImpersonationInfo;
          }>('/auth/impersonate/start-parent', {
            ...opts,
            tenantId: opts.tenantId ?? schoolId,
          });
          return finishParentImpersonation(
            res.tenantId,
            res.token,
            res.impersonation,
            res.schoolSlug ?? school?.slug ?? null,
            res.schoolName,
            navigate
          );
        });
        if (navKind === 'hard') hardNav = true;
      } finally {
        if (!hardNav) setLoading(false);
      }
    },
    [navigate, returnModule, school, schoolId]
  );

  const exitImpersonation = useCallback(async () => {
    if (loading) return;
    const startedAt = Date.now();
    beginImpersonationTransition('Returning to your account…', 'exit', IMPERSONATION_TRANSITION_MS);
    setLoading(true);
    let hardNav = false;
    try {
      const restored = await runWithTransitionMinimum(startedAt, () => exitStaffImpersonation());
      const merged = restored.backup
        ? {
            ...restored.backup.user,
            ...restored.user,
            isPrimaryAdmin:
              restored.user.isPrimaryAdmin === true || restored.backup.user.isPrimaryAdmin === true,
          }
        : restored.user;

      applySession(restored.token, merged as Record<string, unknown>);
      applyPostExitTenantContext(merged as Record<string, unknown>, restored.backup);

      setImpersonation({ active: false });
      saveMeta({ active: false });
      prepareReturnToAdminDashboard(restored.backup);

      toast({ title: 'Impersonation ended', description: 'Back to your account' });

      const dest = resolvePostImpersonationPath(merged as Record<string, unknown>, restored.backup);
      if (restored.backup?.startedFromSuperAdmin || dest === '/super-admin') {
        window.location.href = dest;
        hardNav = true;
        return;
      }

      navigate(dest, { replace: true });
    } catch (e: unknown) {
      clearImpersonationTransition();
      toast({
        title: 'Could not exit impersonation',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      if (!hardNav) setLoading(false);
    }
  }, [applySession, loading, navigate]);

  const value = useMemo(
    () => ({
      impersonation: impersonation.active
        ? { ...impersonation, schoolName: impersonation.schoolName || school?.name }
        : impersonation,
      isImpersonating,
      loading,
      canImpersonate,
      startStaffImpersonation,
      startAutoImpersonation,
      startParentImpersonation,
      exitImpersonation,
    }),
    [
      impersonation,
      school?.name,
      loading,
      isImpersonating,
      canImpersonate,
      startStaffImpersonation,
      startAutoImpersonation,
      startParentImpersonation,
      exitImpersonation,
    ]
  );

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  );
};

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}

export function useImpersonationOptional() {
  return useContext(ImpersonationContext);
}
