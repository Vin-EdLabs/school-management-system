import React, { createContext, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '../services/api';

/** Client-side audit payload (synced to server; immutable on server). */
export interface AuditLog {
  id?: string;
  actionType: string;
  module: string;
  itemId?: string;
  itemName?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

interface AuditContextType {
  /** Sends an append-only audit event to the server (non-blocking). */
  addAuditLog: (log: Omit<AuditLog, 'id'>) => Promise<void>;
}

const AuditContext = createContext<AuditContextType | undefined>(undefined);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const addAuditLog = useCallback(
    async (log: Omit<AuditLog, 'id'>) => {
      if (!user) return;
      try {
        let entityId: number | undefined;
        if (log.itemId != null && log.itemId !== '') {
          const n = parseInt(String(log.itemId), 10);
          if (Number.isFinite(n)) entityId = n;
        }
        await apiService.post('/audit/log', {
          action: String(log.actionType || 'ACTION').toUpperCase().slice(0, 100),
          module: log.module || 'general',
          entityType: 'UI',
          entityId,
          status: 'success',
          summary: (log.itemName || `${log.module}: ${log.actionType}`).slice(0, 2000),
          details: {
            ...log.details,
            reason: log.reason,
            clientUsername: user.username,
            clientRole: user.role,
          },
        });
      } catch (e) {
        console.warn('[audit] client log failed', e);
      }
    },
    [user]
  );

  return <AuditContext.Provider value={{ addAuditLog }}>{children}</AuditContext.Provider>;
};

export const useAudit = () => {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error('useAudit must be used within an AuditProvider');
  }
  return context;
};
