
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiService } from '../services/api';
import { initInactivityTracker, isPWAInstalled, stopInactivityTracker } from '../utils/inactivityTracker';
import { clearActiveTermWelcomeDismiss } from '../components/onboarding/ActiveTermWelcomeModal';
import { startSessionPulse, stopSessionPulse, endSessionPulse } from '../utils/sessionPulse';
import { isSchoolTenantView } from '../utils/schoolAdminView';
import { HEADMASTER_MODULES } from '../utils/headmasterPortal';

const PRIMARY_ADMIN_MODULES = [
  'students', 'teachers', 'other-staff', 'classes', 'calendar', 'fees', 'income', 'expenses',
  'transactions', 'cash-bank', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'term-budget',
  'settings', 'settings-full', 'payment-accounts', 'appointment-letter-settings', 'admission-letter-settings',
  'id-cards', 'id-cards-bulk-print', 'id-card-settings', 'lost-cards', 'users', 'audit', 'print-fee-status',
  'finance-statement', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant',
  'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'parent-accounts',
  'manual-adjustments', 'birthdays', 'transport-overview', 'transport-map', 'transport-routes',
  'transport-vehicles', 'transport-drivers', 'transport-students', 'end-of-year', 'invoices',
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
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  verifyPassword: (password: string) => Promise<boolean>;
  hasAccess: (module: string) => boolean;
  /** Super-admin on the platform dashboard — not when viewing a school. */
  isPlatformSuperAdmin: boolean;
  /** Primary admin powers (includes super-admin acting inside a school). */
  actsAsPrimaryAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    const token = localStorage.getItem('authToken');
    const savedUser = localStorage.getItem('rosaGardensUser');

    if (token && savedUser) {
      // Verify token is still valid
      apiService.get('/auth/me')
        .then((response: any) => {
          if (response.user) {
            setIsAuthenticated(true);
            setToken(token);
            setUser({
              ...response.user,
              isPrimaryAdmin: response.user.isPrimaryAdmin,
              otherStaffId: response.user.otherStaffId ?? null,
            });
            // start inactivity tracking for non-PWA / non-parent sessions
            try { initInactivityTracker(); } catch (e) { /* ignore */ }
            try { startSessionPulse(); } catch (e) { /* ignore */ }
          } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('rosaGardensUser');
          }
        })
        .catch(() => {
          localStorage.removeItem('authToken');
          localStorage.removeItem('rosaGardensUser');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string, role: UserRole, tenantId?: number): Promise<boolean> => {
    try {
      const payload: { username: string; password: string; role?: UserRole; tenantId?: number; is_pwa?: boolean } = {
        username,
        password,
        role,
        is_pwa: isPWAInstalled(),
      };
      if (tenantId !== undefined && tenantId !== null && !isNaN(tenantId)) {
        payload.tenantId = Number(tenantId);
      }
      const response: any = await apiService.post('/auth/login', payload);

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

    if (user.role === 'super-admin') {
      const modules = inSchoolView ? PRIMARY_ADMIN_MODULES : PLATFORM_SUPER_ADMIN_MODULES;
      return (modules as readonly string[]).includes(module);
    }

    if (user.role === 'administrator' && user.isPrimaryAdmin) {
      return (PRIMARY_ADMIN_MODULES as readonly string[]).includes(module);
    }

    // Additional administrators: academic only
    if (user.role === 'administrator') {
      return ['students', 'teachers', 'other-staff', 'classes', 'calendar', 'dashboard', 'settings', 'settings-password-only', 'print-fee-status', 'records', 'support-chat', 'parent-desk', 'push-notifications', 'audit', 'parent-accounts', 'birthdays', 'transport-overview', 'transport-map', 'transport-routes', 'transport-vehicles', 'transport-drivers', 'transport-students'].includes(module);
    }

    // Finance: financial sections only (financial dashboard, not the general admin dashboard)
    if (user.role === 'finance') {
      return ['students-view-only', 'teachers-view-only', 'other-staff-view-only', 'fees', 'income', 'expenses', 'transactions', 'cash-bank', 'payroll', 'reports', 'financial-dashboard', 'term-budget', 'calendar', 'settings', 'settings-password-only', 'payment-accounts', 'print-fee-status', 'finance-statement', 'ai-assistant', 'support-chat', 'parent-desk', 'audit', 'manual-adjustments', 'invoices'].includes(module);
    }

    // Teacher: teacher section + profile + payment history
    if (user.role === 'teacher') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only', 'birthdays'].includes(module);
    }

    // Staff (non-teaching): similar to teacher
    if (user.role === 'staff') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only'].includes(module);
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

    // Driver: driver role
    if (user.role === 'driver') {
      return ['settings', 'settings-password-only'].includes(module);
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
