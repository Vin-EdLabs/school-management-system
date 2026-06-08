
import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiService } from '../services/api';

export type UserRole = 'administrator' | 'finance' | 'super-admin' | 'teacher' | 'staff';

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
      const payload: { username: string; password: string; role?: UserRole; tenantId?: number } = {
        username,
        password,
        role,
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
      apiService.post('/auth/logout', {}).catch(() => { });
    }
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
      return ['students', 'teachers', 'classes', 'calendar', 'fees', 'income', 'expenses', 'transactions', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'settings', 'settings-full', 'users', 'audit', 'print-fee-status', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant', 'schools', 'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'manual-adjustments'].includes(module);
    }

    // Primary admin: full school control except school creation (sees everything)
    if (user.role === 'administrator' && user.isPrimaryAdmin) {
      return ['students', 'teachers', 'classes', 'calendar', 'fees', 'income', 'expenses', 'transactions', 'payroll', 'reports', 'dashboard', 'financial-dashboard', 'settings', 'settings-full', 'users', 'audit', 'print-fee-status', 'teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'ai-assistant', 'records', 'subjects', 'support-chat', 'push-notifications', 'parent-desk', 'manual-adjustments'].includes(module);
    }

    // Additional administrators: academic only
    if (user.role === 'administrator') {
      return ['students', 'teachers', 'classes', 'calendar', 'dashboard', 'settings', 'settings-password-only', 'print-fee-status', 'records', 'support-chat', 'parent-desk', 'push-notifications', 'audit'].includes(module);
    }

    // Finance: financial sections only
    if (user.role === 'finance') {
      return ['students-view-only', 'teachers-view-only', 'fees', 'income', 'expenses', 'transactions', 'payroll', 'reports', 'financial-dashboard', 'dashboard', 'settings', 'settings-password-only', 'print-fee-status', 'ai-assistant', 'support-chat', 'parent-desk', 'audit', 'manual-adjustments'].includes(module);
    }

    // Teacher: teacher section + profile + payment history
    if (user.role === 'teacher') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-payment-history', 'settings', 'settings-password-only'].includes(module);
    }

    // Staff (non-teaching): similar to teacher
    if (user.role === 'staff') {
      return ['teacher-dashboard', 'teacher-classes', 'attendance', 'grades', 'calendar', 'teacher-profile', 'teacher-payment-history', 'settings', 'settings-password-only'].includes(module);
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
