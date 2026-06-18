
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { initInactivityTracker, isPWAInstalled, stopInactivityTracker } from '../utils/inactivityTracker';
import { clearActiveTermWelcomeDismiss } from '../components/onboarding/ActiveTermWelcomeModal';
import { startSessionPulse, stopSessionPulse, endSessionPulse } from '../utils/sessionPulse';

export type UserRole = 'administrator' | 'finance' | 'super-admin' | 'teacher' | 'staff' | 'driver';

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
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

    // Super-admin: full access including school creation
    if (user.role === 'super-admin') {
      return ['students', 'teachers', 'other-staff', 'classes', 'calendar', 'fees', 'income', 'expenses', 'transactions', 'cash-bank', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'term-budget', 'settings', 'settings-full', 'payment-accounts', 'appointment-letter-settings', 'admission-letter-settings', 'users', 'audit', 'print-fee-status', 'finance-statement', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant', 'schools', 'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'parent-accounts', 'manual-adjustments', 'end-of-year', 'transport-overview', 'transport-map', 'transport-routes', 'transport-vehicles', 'transport-drivers', 'transport-students'].includes(module);
    }

    // Primary admin: full school control except school creation (sees everything)
    if (user.role === 'administrator' && user.isPrimaryAdmin) {
      return ['students', 'teachers', 'other-staff', 'classes', 'calendar', 'fees', 'income', 'expenses', 'transactions', 'cash-bank', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'term-budget', 'settings', 'settings-full', 'payment-accounts', 'appointment-letter-settings', 'admission-letter-settings', 'users', 'audit', 'print-fee-status', 'finance-statement', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant', 'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'parent-accounts', 'manual-adjustments', 'transport-overview', 'transport-map', 'transport-routes', 'transport-vehicles', 'transport-drivers', 'transport-students'].includes(module);
    }

    // Additional administrators: academic only
    if (user.role === 'administrator') {
      return ['students', 'teachers', 'other-staff', 'classes', 'calendar', 'dashboard', 'settings', 'settings-password-only', 'print-fee-status', 'records', 'support-chat', 'parent-desk', 'push-notifications', 'audit', 'parent-accounts', 'transport-overview', 'transport-map', 'transport-routes', 'transport-vehicles', 'transport-drivers', 'transport-students'].includes(module);
    }

    // Finance: financial sections only (financial dashboard, not the general admin dashboard)
    if (user.role === 'finance') {
      return ['students-view-only', 'teachers-view-only', 'other-staff-view-only', 'fees', 'income', 'expenses', 'transactions', 'cash-bank', 'payroll', 'reports', 'financial-dashboard', 'term-budget', 'calendar', 'settings', 'settings-password-only', 'payment-accounts', 'print-fee-status', 'finance-statement', 'ai-assistant', 'support-chat', 'parent-desk', 'audit', 'manual-adjustments'].includes(module);
    }

    // Teacher: teacher section + profile + payment history
    if (user.role === 'teacher') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only'].includes(module);
    }

    // Staff (non-teaching): similar to teacher
    if (user.role === 'staff') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-appointment-letters', 'teacher-payment-history', 'settings', 'settings-password-only'].includes(module);
    }

    // Driver: driver role
    if (user.role === 'driver') {
      return ['settings', 'settings-password-only'].includes(module);
    }

    return false;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, token, login, logout, changePassword, verifyPassword, hasAccess, loading }}>
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
