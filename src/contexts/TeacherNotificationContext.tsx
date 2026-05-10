import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export type TeacherNotifKind = 'salary' | 'admin';

export interface TeacherNotifItem {
  id: string;
  kind: TeacherNotifKind;
  title: string;
  body: string;
  at: number;
  read: boolean;
}

interface TeacherNotificationContextValue {
  items: TeacherNotifItem[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
}

const TeacherNotificationContext = createContext<TeacherNotificationContextValue | undefined>(undefined);

const STORAGE_PREFIX = 'rosaTeacherNotif:';

function loadStored(tenantId: number | null | undefined): TeacherNotifItem[] {
  if (tenantId == null) return [];
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${tenantId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeacherNotifItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveStored(tenantId: number | null | undefined, items: TeacherNotifItem[]) {
  if (tenantId == null) return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${tenantId}`, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* ignore quota */
  }
}

export const TeacherNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<TeacherNotifItem[]>([]);

  const isRecipient = user?.role === 'teacher' || user?.role === 'staff';

  useEffect(() => {
    if (!isRecipient || !user?.tenantId) {
      setItems([]);
      return;
    }
    setItems(loadStored(user.tenantId));
  }, [isRecipient, user?.tenantId]);

  useEffect(() => {
    if (!isRecipient || user?.tenantId == null) return;
    saveStored(user.tenantId, items);
  }, [items, isRecipient, user?.tenantId]);

  const pushItem = useCallback((item: TeacherNotifItem) => {
    setItems((prev) => [item, ...prev].slice(0, 50));
  }, []);

  useEffect(() => {
    if (!socket || !isRecipient || !user?.tenantId) return;

    const onTenant = (evt: Record<string, unknown>) => {
      const tid = evt.tenantId as number | undefined;
      if (tid !== user.tenantId) return;

      const entity = String(evt.entity || '');

      if (entity === 'admin-staff-test-push') {
        const title = String(evt.title || 'School message');
        const body = String(evt.body || '').trim();
        if (!body) return;
        const at = Number(evt.at) || Date.now();
        const id = `push-test-${at}-${title.slice(0, 24)}`;
        setItems((prev) => {
          if (prev.some((p) => p.id === id)) return prev;
          return [{ id, kind: 'admin' as const, title, body, at, read: false }, ...prev].slice(0, 50);
        });
        toast(title, {
          description: body.length > 160 ? `${body.slice(0, 160)}…` : body,
          duration: 10_000,
          className: 'border-l-4 border-l-violet-500',
        });
        return;
      }

      if (entity === 'school-staff-notice' || entity === 'teacher-admin-notice') {
        const title = String(evt.title || 'School message');
        const body = String(evt.body || '').trim();
        if (!body) return;
        const at = Number(evt.at) || Date.now();
        const id = `admin-${at}-${title.slice(0, 24)}-${body.slice(0, 40)}`;
        setItems((prev) => {
          if (prev.some((p) => p.id === id || (p.kind === 'admin' && p.title === title && p.body === body && Math.abs(p.at - at) < 2000)))
            return prev;
          return [{ id, kind: 'admin' as const, title, body, at, read: false }, ...prev].slice(0, 50);
        });
        toast(title, {
          description: body.length > 160 ? `${body.slice(0, 160)}…` : body,
          duration: 12_000,
          className: 'border-l-4 border-l-indigo-500',
        });
        return;
      }

      if (entity === 'salary-payment') {
        const payeeType = String(evt.payee_type || '');
        const payeeId = Number(evt.payee_id);
        if (!payeeId || Number.isNaN(payeeId)) return;

        const myTeacherId = user.teacherId != null && user.teacherId !== '' ? Number(user.teacherId) : NaN;
        const myStaffId = user.otherStaffId != null ? Number(user.otherStaffId) : NaN;

        const forMe =
          (user.role === 'teacher' && payeeType === 'teacher' && !Number.isNaN(myTeacherId) && myTeacherId === payeeId) ||
          (user.role === 'staff' && payeeType === 'staff' && !Number.isNaN(myStaffId) && myStaffId === payeeId);

        if (!forMe) return;

        const month = Number(evt.month);
        const year = Number(evt.year);
        const amount = Number(evt.amount);
        const period =
          !Number.isNaN(month) && !Number.isNaN(year)
            ? new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : 'your account';
        const amtStr = !Number.isNaN(amount) ? `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '';
        const title = 'Salary recorded';
        const body = amtStr ? `Payment for ${period}: ${amtStr}.` : `A salary payment was recorded for ${period}.`;
        const at = Number(evt.at) || Date.now();
        const id = `salary-${payeeId}-${month}-${year}-${at}`;
        setItems((prev) => {
          if (prev.some((p) => p.id === id)) return prev;
          return [{ id, kind: 'salary' as const, title, body, at, read: false }, ...prev].slice(0, 50);
        });
        toast(title, {
          description: body,
          duration: 14_000,
          className: 'border-l-4 border-l-emerald-500',
        });
      }
    };

    socket.on('tenant-data-changed', onTenant);
    return () => {
      socket.off('tenant-data-changed', onTenant);
    };
  }, [socket, isRecipient, user, pushItem]);

  const unreadCount = useMemo(() => items.filter((i) => !i.read).length, [items]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, unreadCount, markRead, markAllRead, dismiss }),
    [items, unreadCount, markRead, markAllRead, dismiss],
  );

  return <TeacherNotificationContext.Provider value={value}>{children}</TeacherNotificationContext.Provider>;
};

export function useTeacherNotifications() {
  const ctx = useContext(TeacherNotificationContext);
  if (!ctx) throw new Error('useTeacherNotifications must be used within TeacherNotificationProvider');
  return ctx;
}
