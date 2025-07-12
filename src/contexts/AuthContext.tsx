
import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  changePassword: (newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('admin123');

  useEffect(() => {
    const authStatus = localStorage.getItem('rosaGardensAuth');
    const savedPassword = localStorage.getItem('rosaGardensPassword');
    
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    
    if (savedPassword) {
      setCurrentPassword(savedPassword);
    }
  }, []);

  const login = (username: string, password: string): boolean => {
    if (username === 'admin' && password === currentPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('rosaGardensAuth', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('rosaGardensAuth');
  };

  const changePassword = (newPassword: string) => {
    setCurrentPassword(newPassword);
    localStorage.setItem('rosaGardensPassword', newPassword);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, changePassword }}>
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
