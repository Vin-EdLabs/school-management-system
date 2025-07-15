
import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'administrator' | 'finance' | 'super-admin';

interface User {
  username: string;
  role: UserRole;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (username: string, password: string, role: UserRole) => boolean;
  logout: () => void;
  changePassword: (newPassword: string) => void;
  hasAccess: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  
  // Default passwords for each role
  const [passwords, setPasswords] = useState({
    'super-admin': 'superadmin123',
    'finance': 'finance123', 
    'administrator': 'admin123'
  });

  useEffect(() => {
    const authStatus = localStorage.getItem('rosaGardensAuth');
    const savedUser = localStorage.getItem('rosaGardensUser');
    const savedPasswords = localStorage.getItem('rosaGardensPasswords');
    
    if (authStatus === 'true' && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    
    if (savedPasswords) {
      setPasswords(JSON.parse(savedPasswords));
    }
  }, []);

  const login = (username: string, password: string, role: UserRole): boolean => {
    // Check if username is 'admin' and password matches the role's password
    if (username === 'admin' && password === passwords[role]) {
      const newUser: User = { username, role };
      setIsAuthenticated(true);
      setUser(newUser);
      localStorage.setItem('rosaGardensAuth', 'true');
      localStorage.setItem('rosaGardensUser', JSON.stringify(newUser));
      
      // Add audit log for login (will be handled by AuditContext after login)
      setTimeout(() => {
        const event = new CustomEvent('userLogin', { 
          detail: { username, role, timestamp: new Date() } 
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
      'administrator': ['students', 'teachers', 'classes', 'dashboard', 'settings-password-only'],
      'finance': ['students-view-only', 'teachers-view-only', 'fees', 'income', 'expenses', 'reports', 'financial-dashboard', 'settings-password-only'],
      'super-admin': ['students', 'teachers', 'classes', 'fees', 'income', 'expenses', 'reports', 'dashboard', 'financial-dashboard', 'settings', 'audit']
    };

    return rolePermissions[user.role].includes(module);
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
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
