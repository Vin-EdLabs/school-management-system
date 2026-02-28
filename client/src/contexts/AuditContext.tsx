
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthContext } from './AuthContext';

export interface AuditLog {
  id: string;
  actionType: 'Login' | 'Edit' | 'Delete';
  module: string;
  itemId?: string;
  itemName?: string;
  username: string;
  role: string;
  timestamp: Date;
  reason?: string;
  details?: any;
}

interface AuditContextType {
  auditLogs: AuditLog[];
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp' | 'username' | 'role'>) => void;
  deleteAuditLog: (id: string) => void;
  clearAllLogs: () => void;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const savedLogs = localStorage.getItem('rosaGardensAuditLogs');
    if (savedLogs) {
      const parsedLogs = JSON.parse(savedLogs).map((log: any) => ({
        ...log,
        timestamp: new Date(log.timestamp)
      }));
      setAuditLogs(parsedLogs);
    }
  }, []);

  const addAuditLog = (log: Omit<AuditLog, 'id' | 'timestamp' | 'username' | 'role'>) => {
    if (!user) return;

    const newLog: AuditLog = {
      ...log,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      username: (user as any).staffId ?? (user as any).username,
      role: user.role
    };

    setAuditLogs(prev => {
      const updated = [newLog, ...prev];
      localStorage.setItem('rosaGardensAuditLogs', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteAuditLog = (id: string) => {
    setAuditLogs(prev => {
      const updated = prev.filter(log => log.id !== id);
      localStorage.setItem('rosaGardensAuditLogs', JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllLogs = () => {
    setAuditLogs([]);
    localStorage.removeItem('rosaGardensAuditLogs');
  };

  return (
    <AuditContext.Provider value={{ auditLogs, addAuditLog, deleteAuditLog, clearAllLogs }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};
