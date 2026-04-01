
import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiService } from '../services/api';
import * as authService from '../services/authService';

export type UserRole = 'administrator' | 'finance' | 'super-admin' | 'teacher' | 'accountant' | 'admin';

interface User {
  id?: string | number;
  username?: string;
  staffId?: string;
  role: UserRole;
  teacherId?: string; // For teachers to identify which classes they teach
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (staffId: string, password: string, role: UserRole) => boolean;
  logout: () => void;
  changePassword: (newPassword: string) => void;
  hasAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
export { AuthContext };

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize auth state from localStorage synchronously so refreshes don't flash unauthenticated
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rosaGardensAuth') === 'true';
    } catch (e) {
      return false;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const s = localStorage.getItem('rosaGardensUser');
      return s ? JSON.parse(s) : null;
    } catch (e) {
      return null;
    }
  });

  // Default passwords for each role
  const [passwords, setPasswords] = useState({
    'super-admin': 'superadmin123',
    'finance': 'finance123',
    'administrator': 'admin123',
    'teacher': 'teacher123'
  });

  useEffect(() => {
    // On mount attempt to restore session from httpOnly cookie via API
    let mounted = true;
    (async () => {
      try {
        // Try to restore token from localStorage and set on apiService
        const savedToken = localStorage.getItem('rosaGardensToken');
        if (savedToken) {
          apiService.setAuthToken(savedToken);
        }

        const resp: any = await authService.session();
        const rawUser = resp?.user || (resp?.data && resp.data.user) || null;
        if (mounted && rawUser) {
          const normalizedRole = (rawUser.role || '').toString().toLowerCase().replace(/[_\s]+/g, '-');
          const user = { ...rawUser, role: normalizedRole };
          setIsAuthenticated(true);
          setUser(user);
          localStorage.setItem('rosaGardensAuth', 'true');
          localStorage.setItem('rosaGardensUser', JSON.stringify(user));
        }
      } catch (e) {
        // no session available
      }
    })();

    const savedPasswords = localStorage.getItem('rosaGardensPasswords');
    if (savedPasswords) {
      setPasswords(JSON.parse(savedPasswords));
    }
    return () => { mounted = false };
  }, []);

  // Listen for cross-component login events (e.g. API login via hook)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      const raw = detail?.user || (detail?.staffId && { staffId: detail.staffId, role: detail.role });
      if (raw) {
        try {
          const normalizedRole = (raw.role || '').toString().toLowerCase().replace(/[_\s]+/g, '-');
          const payloadUser = { ...raw, role: normalizedRole } as User;
          setIsAuthenticated(true);
          setUser(payloadUser);
          localStorage.setItem('rosaGardensAuth', 'true');
          localStorage.setItem('rosaGardensUser', JSON.stringify(payloadUser));
        } catch (err) {
          // ignore
        }
      }
    };

    window.addEventListener('userLogin', handler as EventListener);
    return () => window.removeEventListener('userLogin', handler as EventListener);
  }, []);

  const login = (staffId: string, password: string, role: UserRole): boolean => {
    // Check if staffId is 'admin' and password matches the role's password
    if (staffId === 'admin' && password === passwords[role]) {
      const normalizedRole = role.toString().toLowerCase().replace(/[_\s]+/g, '-');
      const newUser: User = {
        staffId,
        role: normalizedRole as UserRole,
        // For demo purposes, assign teacherId for teacher role
        ...(normalizedRole === 'teacher' && { teacherId: 'teacher-1' })
      };

      setIsAuthenticated(true);
      setUser(newUser);
      localStorage.setItem('rosaGardensAuth', 'true');
      localStorage.setItem('rosaGardensUser', JSON.stringify(newUser));

      // Try to perform a real backend login in the background so we get a token
      (async () => {
        try {
          const resp: any = await authService.login({ staffId, password });
          const token = resp?.token || (resp as any)?.data?.token;
          const userFromServer = resp?.user || (resp as any)?.data?.user;
          if (token) {
            apiService.setAuthToken(token);
            try { localStorage.setItem('rosaGardensToken', token); } catch (e) { /* ignore */ }
          }
          if (userFromServer) {
            try {
              localStorage.setItem('rosaGardensAuth', 'true');
              localStorage.setItem('rosaGardensUser', JSON.stringify(userFromServer));
              const event = new CustomEvent('userLogin', { detail: { user: userFromServer } });
              window.dispatchEvent(event);
            } catch (e) { /* ignore */ }
          }
        } catch (e) {
          // If backend login fails, we still keep the local demo login
          // eslint-disable-next-line no-console
          console.debug('Backend login not available or failed; continuing with demo login');
        }
      })();

      // Add audit log for login (will be handled by AuditContext after login)
      setTimeout(() => {
        const event = new CustomEvent('userLogin', {
          detail: { staffId, role, timestamp: new Date() }
        });
        window.dispatchEvent(event);
      }, 100);

      return true;
    }

    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem('rosaGardensAuth');
    localStorage.removeItem('rosaGardensUser');
    try { localStorage.removeItem('rosaGardensToken'); } catch (e) { }
    apiService.setAuthToken(null);
  };

  const changePassword = (newPassword: string) => {
    if (!user) return;

    const updatedPasswords = {
      ...passwords,
      [user.role]: newPassword
    };
    setPasswords(updatedPasswords);
    localStorage.setItem('rosaGardensPasswords', JSON.stringify(updatedPasswords));
  };

  const hasAccess = (module: string): boolean => {
    if (!user) return false;

    const rolePermissions = {
      'administrator': ['students', 'teachers', 'staff', 'classes', 'subjects', 'calendar', 'dashboard', 'settings-password-only', 'print-fee-status', 'schedules', 'timetable', 'attendance', 'attendance-reports'],
      'admin': ['students', 'teachers', 'staff', 'classes', 'subjects', 'calendar', 'dashboard', 'settings-password-only', 'print-fee-status', 'schedules', 'timetable', 'attendance', 'attendance-reports'],
      'finance': ['students-view-only', 'teachers-view-only', 'staff-view-only', 'fees', 'income', 'expenses', 'reports', 'financial-dashboard', 'dashboard', 'settings-password-only', 'print-fee-status', 'ai-assistant', 'payroll'],
      'accountant': ['students-view-only', 'teachers-view-only', 'staff-view-only', 'fees', 'income', 'expenses', 'reports', 'financial-dashboard', 'dashboard', 'settings-password-only', 'print-fee-status', 'ai-assistant', 'payroll'],
      'teacher': ['teacher-dashboard', 'teacher-classes', 'attendance', 'attendance-reports', 'grades', 'calendar', 'settings-password-only'],
      'staff': ['dashboard', 'settings-password-only'],
      'super-admin': ['students', 'teachers', 'staff', 'classes', 'subjects', 'calendar', 'fees', 'income', 'expenses', 'reports', 'dashboard', 'financial-dashboard', 'settings', 'audit', 'print-fee-status', 'teacher-classes', 'attendance', 'attendance-reports', 'grades', 'ai-assistant', 'payroll', 'schedules', 'timetable']
    };

    const perms = rolePermissions[user.role] ?? rolePermissions['staff'];
    return perms.includes(module);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, changePassword, hasAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Provide a safe fallback to avoid runtime crashes when a component
    // inadvertently calls useAuth outside of the provider (useful during
    // development and tests). Consumers should treat `isAuthenticated === false`
    // as unauthenticated.
    return {
      isAuthenticated: false,
      user: null,
      login: () => false,
      logout: () => { },
      changePassword: () => { },
      hasAccess: () => false,
    } as AuthContextType;
  }
  return context;
};
