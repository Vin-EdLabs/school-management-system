
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
  const [currentPassword, setCurrentPassword] = useState('admin123');

  useEffect(() => {
    const authStatus = localStorage.getItem('rosaGardensAuth');
    const savedUser = localStorage.getItem('rosaGardensUser');
    const savedPassword = localStorage.getItem('rosaGardensPassword');
    
    if (authStatus === 'true' && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    
    if (savedPassword) {
      setCurrentPassword(savedPassword);
    }
  }, []);

  const login = (username: string, password: string, role: UserRole): boolean => {
    if (username === 'admin' && password === currentPassword) {
      const newUser: User = { username, role };
      setIsAuthenticated(true);
      setUser(newUser);
      localStorage.setItem('rosaGardensAuth', 'true');
      localStorage.setItem('rosaGardensUser', JSON.stringify(newUser));
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
    setCurrentPassword(newPassword);
    localStorage.setItem('rosaGardensPassword', newPassword);
  };

  const hasAccess = (module: string): boolean => {
    if (!user) return false;
    
    const rolePermissions = {
      'administrator': ['students', 'teachers', 'classes', 'dashboard', 'settings'],
      'finance': ['fees', 'income', 'expenses', 'reports', 'financial-dashboard', 'settings'],
      'super-admin': ['students', 'teachers', 'classes', 'fees', 'income', 'expenses', 'reports', 'dashboard', 'financial-dashboard', 'settings']
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
