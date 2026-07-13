
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { initInactivityTracker, isPWAInstalled, stopInactivityTracker } from '../utils/inactivityTracker';
import { clearActiveTermWelcomeDismiss } from '../components/onboarding/ActiveTermWelcomeModal';
import { startSessionPulse, stopSessionPulse, endSessionPulse } from '../utils/sessionPulse';
import { saveStaffImpersonationToken, tokenHasImpersonator, isStaffImpersonationActive } from '../utils/impersonationHelpers';
import { isSchoolTenantView, shouldUseAdministratorDashboard } from '../utils/schoolAdminView';
import { detectTenantSlugFromHost } from '../utils/tenantHost';
import { consumeSuperAdminHandoffFromHash } from '../utils/superAdminSessionHandoff';
import { HEADMASTER_MODULES } from '../utils/headmasterPortal';

const PRIMARY_ADMIN_MODULES = [
  'students', 'teachers', 'other-staff', 'classes', 'calendar', 'fees', 'income', 'expenses',
  'transactions', 'cash-bank', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'term-budget',
  'settings', 'settings-full', 'payment-accounts', 'appointment-letter-settings', 'admission-letter-settings',
  'grade-configuration',
  'id-cards', 'id-cards-bulk-print', 'id-card-settings', 'lost-cards', 'users', 'audit', 'print-fee-status',
  'finance-statement', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant',
  'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'parent-accounts',
  'manual-adjustments', 'birthdays', 'transport-overview', 'transport-map', 'transport-routes',
  'transport-vehicles', 'transport-drivers', 'transport-students', 'end-of-year', 'invoices',
  'daily-fees',
  'payment-submissions',
  'checkin-dashboard',
  'checkin-settings',
  'staff-attendance',
  'staff-attendance-settings',
  'my-staff-attendance',
  'complaints',
  'my-complaints',
] as const;

const PLATFORM_SUPER_ADMIN_MODULES = [...PRIMARY_ADMIN_MODULES, 'schools'] as const;

export type UserRole = 'administrator' | 'finance' | 'super-admin' | 'teacher' | 'staff' | 'driver' | 'headmaster';

interface User {
  id: number;
  username: string;
  fullName: string | null;
  role: UserRole;
  tenantId: number | null;
  teacherId?: string;
  otherStaffId?: number | null;
  isPrimaryAdmin?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (username: string, password: string, role: UserRole, tenantId?: number) => Promise<boolean>;
  logout: () => void;
  applySession: (token: string, userPayload: Record<string, unknown>) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  hasAccess: (module: string) => boolean;
  isPlatformSuperAdmin: boolean;
  actsAsPrimaryAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function userFromStoragePayload(raw: string): User | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.id == null) return null;
    return {
      id: Number(parsed.id),
      username: String(parsed.username || ''),
      fullName: (parsed.fullName as string | null) ?? null,
      role: parsed.role as UserRole,
      tenantId: parsed.tenantId != null ? Number(parsed.tenantId) : null,
      teacherId: parsed.teacherId != null ? String(parsed.teacherId) : undefined,
      otherStaffId: parsed.otherStaffId != null ? Number(parsed.otherStaffId) : null,
      isPrimaryAdmin: parsed.isPrimaryAdmin === true,
    };
  } catch {
    return null;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pathname } = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const inSchoolView = isSchoolTenantView(pathname);
  const isPlatformSuperAdmin = user?.role === 'super-admin' && !inSchoolView;
  const actsAsPrimaryAdmin =
    !!(user?.role === 'administrator' && user.isPrimaryAdmin) ||
    (user?.role === 'super-admin' && inSchoolView);

  useEffect(() => {
    let cancelled = false;
    const handoffToken = consumeSuperAdminHandoffFromHash();
    if (handoffToken) {
      localStorage.setItem('authToken', handoffToken);
    }
    const bootstrapToken = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('rosaGardensUser');

    if (bootstrapToken) {
      if (savedUser) {
        const cachedUser = userFromStoragePayload(savedUser);
        if (cachedUser) {
          setToken(bootstrapToken);
          setUser(cachedUser);
          setIsAuthenticated(true);
          if (tokenHasImpersonator(bootstrapToken)) {
            saveStaffImpersonationToken(bootstrapToken);
          }
          const tid = cachedUser.tenantId;
          if (tid != null && Number.isFinite(tid)) {
            apiService.setTenantContext(tid);
          } else if (cachedUser.role === 'super-admin') {
            const storedSchoolId = localStorage.getItem('currentSchoolId');
            if (storedSchoolId) {
              const schoolId = parseInt(storedSchoolId, 10);
              if (!isNaN(schoolId)) {
                apiService.setTenantContext(schoolId);
              }
            }
          }
        }
      }

      apiService
        .get('/auth/me')
        .then((response: any) => {
          if (cancelled) return;
          const currentToken = localStorage.getItem('authToken');
          if (!currentToken || currentToken !== bootstrapToken) return;

          if (response.user) {
            setIsAuthenticated(true);
            setToken(currentToken);
            const nextUser = {
              ...response.user,
              isPrimaryAdmin: response.user.isPrimaryAdmin,
              otherStaffId: response.user.otherStaffId ?? null,
            };
            setUser(nextUser);
            localStorage.setItem('rosaGardensUser', JSON.stringify(nextUser));
            if (response.user.role === 'super-admin') {
              const storedSchoolId = localStorage.getItem('currentSchoolId');
              if (storedSchoolId) {
                const schoolId = parseInt(storedSchoolId, 10);
                if (!isNaN(schoolId)) {
                  apiService.setTenantContext(schoolId);
                }
              }
            }
            if (response.impersonation?.active) {
              sessionStorage.setItem(
                'impersonation_meta',
                JSON.stringify({ ...response.impersonation, active: true, mode: 'staff' })
              );
              if (tokenHasImpersonator(currentToken)) {
                saveStaffImpersonationToken(currentToken);
              }
            } else if (!isStaffImpersonationActive()) {
              sessionStorage.removeItem('impersonation_meta');
            }
            if (
              response.user.role === 'super-admin' ||
              (response.user.role === 'administrator' && response.user.isPrimaryAdmin)
            ) {
              sessionStorage.setItem('impersonation_admin_eligible', '1');
            }
            try {
              initInactivityTracker();
            } catch {
              /* ignore */
            }
            try {
              startSessionPulse();
            } catch {
              /* ignore */
            }
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('rosaGardensUser');
            setIsAuthenticated(false);
            setUser(null);
            setToken(null);
          }
        })
        .catch(() => {
          if (cancelled) return;
          const currentToken = localStorage.getItem('authToken');
          if (!currentToken || currentToken !== bootstrapToken) return;
          if (tokenHasImpersonator(currentToken) && savedUser && userFromStoragePayload(savedUser)) {
            return;
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('rosaGardensUser');
          setIsAuthenticated(false);
          setUser(null);
          setToken(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (username: string, password: string, role: UserRole, tenantId?: number): Promise<boolean> => {
    try {
      const isSuperAdminLogin = role === 'super-admin';
      const onSchoolPortal = isSchoolTenantView(pathname);
      if (isSuperAdminLogin && !onSchoolPortal) {
        apiService.clearTenantContext();
      }

      const payload: {
        username: string;
        password: string;
        role?: UserRole;
        tenantId?: number;
        subdomain?: string;
        is_pwa?: boolean;
      } = {
        username,
        password,
        role,
        is_pwa: isPWAInstalled(),
      };
      if (!isSuperAdminLogin && tenantId !== undefined && tenantId !== null && !isNaN(tenantId)) {
        payload.tenantId = Number(tenantId);
      }
      if (!isSuperAdminLogin || onSchoolPortal) {
        const subdomain = detectTenantSlugFromHost();
        if (subdomain) {
          payload.subdomain = subdomain;
        }
      }
      const skipTenantHeaders = isSuperAdminLogin && !onSchoolPortal;
      const response: any = await apiService.post('/auth/login', payload, {
        skipTenant: skipTenantHeaders,
        skipTenantHeaders,
      });

      if (response.token && response.user) {
        localStorage.setItem('authToken', response.token);
        localStorage.setItem('rosaGardensUser', JSON.stringify(response.user));
        setIsAuthenticated(true);
        setToken(response.token);
        setUser({
          ...response.user,
          isPrimaryAdmin: response.user.isPrimaryAdmin,
          otherStaffId: response.user.otherStaffId ?? null,
        });

        // start inactivity tracking for non-PWA / non-parent sessions
        try { initInactivityTracker(); } catch (e) { /* ignore */ }
        try { startSessionPulse(); } catch (e) { /* ignore */ }

        const loginTenantId = Number(response.user.tenantId);
        if (Number.isFinite(loginTenantId)) {
          clearActiveTermWelcomeDismiss(loginTenantId);
        } else if (response.user.role === 'super-admin' && tenantId != null && !isNaN(tenantId)) {
          apiService.setTenantContext(Number(tenantId));
          localStorage.setItem('currentSchoolId', String(tenantId));
        }

        try {
          sessionStorage.setItem('personal-todos-login-blink', '1');
          sessionStorage.setItem('scholarnerve-zoom-nudge-login', '1');
          sessionStorage.removeItem('scholarnerve-zoom-nudge-comfortable');
        } catch {
          /* ignore */
        }
        if (
          response.user.role === 'super-admin' ||
          (response.user.role === 'administrator' && response.user.isPrimaryAdmin)
        ) {
          try {
            sessionStorage.setItem('impersonation_admin_eligible', '1');
          } catch {
            /* ignore */
          }
        }

        // Add audit log for login (will be handled by backend)
        setTimeout(() => {
          const event = new CustomEvent('userLogin', {
            detail: { username, role, timestamp: new Date() }
          });
          window.dispatchEvent(event);
        }, 100);

        return true;
      }
      const serverMsg = response?.error || response?.message;
      throw new Error(
        typeof serverMsg === 'string' && serverMsg.trim()
          ? serverMsg.trim()
          : 'Those credentials do not match our records. Check your username and password.'
      );
    } catch (error: any) {
      console.error('Login error:', error);
      if (error instanceof TypeError && String(error.message || '').toLowerCase().includes('fetch')) {
        throw new Error('Failed to fetch');
      }
      const msg = error?.message || error?.response?.data?.error || 'Connection failed';
      throw new Error(typeof msg === 'string' ? msg : 'Login failed');
    }
  };

  const applySession = (newToken: string, userPayload: Record<string, unknown>) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('rosaGardensUser', JSON.stringify(userPayload));
    setIsAuthenticated(true);
    setToken(newToken);
    setUser({
      id: Number(userPayload.id),
      username: String(userPayload.username || ''),
      fullName: (userPayload.fullName as string | null) ?? null,
      role: userPayload.role as UserRole,
      tenantId: userPayload.tenantId != null ? Number(userPayload.tenantId) : null,
      teacherId: userPayload.teacherId != null ? String(userPayload.teacherId) : undefined,
      otherStaffId: userPayload.otherStaffId != null ? Number(userPayload.otherStaffId) : null,
      isPrimaryAdmin: userPayload.isPrimaryAdmin === true,
    });
    const tid = userPayload.tenantId != null ? Number(userPayload.tenantId) : null;
    if (tid && Number.isFinite(tid)) {
      apiService.setTenantContext(tid);
      localStorage.setItem('currentSchoolId', String(tid));
    } else if (userPayload.role === 'super-admin') {
      const storedSchoolId = localStorage.getItem('currentSchoolId');
      if (storedSchoolId) {
        const schoolId = parseInt(storedSchoolId, 10);
        if (!isNaN(schoolId)) {
          apiService.setTenantContext(schoolId);
        }
      }
    }
    if (tokenHasImpersonator(newToken)) {
      saveStaffImpersonationToken(newToken);
    }
    setLoading(false);
  };

  const logout = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      void endSessionPulse();
      apiService.post('/auth/logout', {}).catch(() => { });
    } else {
      stopSessionPulse();
    }
    try { stopInactivityTracker(); } catch (e) { /* ignore */ }
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('rosaGardensUser');
    sessionStorage.removeItem('impersonation_meta');
    sessionStorage.removeItem('impersonation_admin_backup');
    sessionStorage.removeItem('impersonation_admin_eligible');
    sessionStorage.removeItem('scholarnerve-zoom-nudge-login');
    sessionStorage.removeItem('scholarnerve-zoom-nudge-comfortable');
    localStorage.removeItem('impersonation_admin_backup');
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await apiService.post('/auth/change-password', { currentPassword, newPassword });
      return true;
    } catch (error: any) {
      console.error('Change password error:', error);
      return false;
    }
  };

  const verifyPassword = async (password: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await apiService.post('/auth/verify-password', { password });
      return true;
    } catch {
      return false;
    }
  };

  const hasAccess = (module: string): boolean => {
    if (!user) return false;

    if (user.role === 'super-admin' && !inSchoolView) {
      return (PLATFORM_SUPER_ADMIN_MODULES as readonly string[]).includes(module);
    }

    if (actsAsPrimaryAdmin) {
      return (PRIMARY_ADMIN_MODULES as readonly string[]).includes(module);
    }

    // Additional administrators: academic only
    if (user.role === 'administrator') {
      return ['students', 'teachers', 'other-staff', 'classes', 'calendar', 'dashboard', 'settings', 'settings-password-only', 'print-fee-status', 'records', 'support-chat', 'parent-desk', 'push-notifications', 'audit', 'parent-accounts', 'birthdays', 'transport-overview', 'transport-map', 'transport-routes', 'transport-vehicles', 'transport-drivers', 'transport-students', 'checkin-dashboard', 'checkin-settings', 'staff-attendance', 'staff-attendance-settings', 'my-staff-attendance', 'complaints'].includes(module);
    }

    // Finance: financial sections only (financial dashboard, not the general admin dashboard)
    if (user.role === 'finance') {
      return ['students-view-only', 'teachers-view-only', 'other-staff-view-only', 'fees', 'daily-fees', 'income', 'expenses', 'transactions', 'cash-bank', 'payroll', 'reports', 'financial-dashboard', 'term-budget', 'calendar', 'settings', 'settings-password-only', 'payment-accounts', 'print-fee-status', 'finance-statement', 'ai-assistant', 'support-chat', 'parent-desk', 'audit', 'manual-adjustments', 'invoices', 'payment-submissions', 'my-staff-attendance'].includes(module);
    }

    // Teacher: teacher section + profile + payment history
    if (user.role === 'teacher') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only', 'birthdays', 'checkin-staff', 'my-staff-attendance', 'my-complaints'].includes(module);
    }

    // Staff (non-teaching): similar to teacher
    if (user.role === 'staff') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only', 'checkin-staff', 'my-staff-attendance', 'my-complaints'].includes(module);
    }

    // Headmaster: teacher portal (when linked) + school-wide read-only oversight
    if (user.role === 'headmaster') {
      const modules = [...HEADMASTER_MODULES];
      if (!user.teacherId) {
        return modules
          .filter(
            (m) =>
              ![
                'teacher-classes',
                'attendance',
                'grades',
                'teacher-quizzes',
                'teacher-appointment-letters',
                'teacher-payment-history',
              ].includes(m)
          )
          .includes(module);
      }
      return modules.includes(module as (typeof HEADMASTER_MODULES)[number]);
    }

    // Driver: transport + staff clock
    if (user.role === 'driver') {
      return ['settings', 'settings-password-only', 'my-staff-attendance'].includes(module);
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      token,
      login,
      logout,
      applySession,
      changePassword,
      verifyPassword,
      hasAccess,
      isPlatformSuperAdmin,
      actsAsPrimaryAdmin,
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
