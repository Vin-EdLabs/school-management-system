import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

export type TeacherNotifKind = 'salary' | 'admin' | 'parent-desk' | 'support-chat';

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

const SCHOOL_STAFF_ROLES = new Set(['teacher', 'staff', 'headmaster', 'administrator', 'finance']);
const TEACHER_STAFF_ROLES = new Set(['teacher', 'staff']);

/** Parent desk + support alerts are for school leadership only, not classroom staff. */
function filterItemsForRole(role: string | undefined, list: TeacherNotifItem[]): TeacherNotifItem[] {
  if (!role || !TEACHER_STAFF_ROLES.has(role)) return list;
  return list.filter((item) => item.kind === 'admin' || item.kind === 'salary');
}

function storageKeyForUser(user: { role?: string; tenantId?: number | null } | null): string | null {
  if (!user?.role) return null;
  if (user.role === 'super-admin') return `${STORAGE_PREFIX}platform`;
  if (user.tenantId == null) return null;
  if (!SCHOOL_STAFF_ROLES.has(user.role)) return null;
  return `${STORAGE_PREFIX}${user.tenantId}`;
}

function loadStored(key: string | null): TeacherNotifItem[] {
  if (!key) return [];
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TeacherNotifItem[];
    return Array.isArray(parsed) ? parsed.slice(0, 50) : [];
  } catch {
    return [];
  }
}

function saveStored(key: string | null, items: TeacherNotifItem[]) {
  if (!key) return;
  try {
    sessionStorage.setItem(key, JSON.stringify(items.slice(0, 50)));
  } catch {
    /* ignore quota */
  }
}

function showOnScreenNotification(title: string, body: string, accent: 'indigo' | 'sky' | 'violet' | 'emerald') {
  const border =
    accent === 'sky'
      ? 'border-l-sky-500'
      : accent === 'violet'
        ? 'border-l-violet-500'
        : accent === 'emerald'
          ? 'border-l-emerald-500'
          : 'border-l-indigo-500';

  toast(title, {
    description: body.length > 160 ? `${body.slice(0, 160)}…` : body,
    duration: 12_000,
    className: `border-l-4 ${border}`,
  });

  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body: body.length > 200 ? `${body.slice(0, 200)}…` : body });
    } catch {
      /* ignore */
    }
  }
}

export const TeacherNotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [items, setItems] = useState<TeacherNotifItem[]>([]);

  const storeKey = storageKeyForUser(user);
  const isSchoolStaff = !!user?.role && SCHOOL_STAFF_ROLES.has(user.role);
  const isSuperAdmin = user?.role === 'super-admin';
  const isRecipient = isSchoolStaff || isSuperAdmin;
  const hydratedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isRecipient) {
      setItems([]);
      hydratedKeyRef.current = null;
      return;
    }
    // Keep in-memory alerts while tenant context is still loading.
    if (!storeKey) return;

    if (hydratedKeyRef.current === storeKey) return;

    const previousKey = hydratedKeyRef.current;
    hydratedKeyRef.current = storeKey;
    const stored = filterItemsForRole(user?.role, loadStored(storeKey));

    setItems((prev) => {
      if (previousKey != null && previousKey !== storeKey) {
        return stored;
      }
      const scopedPrev = filterItemsForRole(user?.role, prev);
      if (scopedPrev.length === 0) return stored;
      const ids = new Set(scopedPrev.map((p) => p.id));
      const merged = [...scopedPrev];
      for (const item of stored) {
        if (!ids.has(item.id)) merged.push(item);
      }
      merged.sort((a, b) => b.at - a.at);
      return merged.slice(0, 50);
    });
  }, [isRecipient, storeKey, user?.role]);

  useEffect(() => {
    if (!isRecipient || !storeKey) return;
    saveStored(storeKey, filterItemsForRole(user?.role, items));
  }, [items, isRecipient, storeKey, user?.role]);

  const pushItem = useCallback((item: TeacherNotifItem) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) return prev;
      return [item, ...prev].slice(0, 50);
    });
  }, []);

  useEffect(() => {
    if (!socket || !isRecipient || !user) return;

    const onTenant = (evt: Record<string, unknown>) => {
      const tid = evt.tenantId as number | undefined;
      if (isSchoolStaff && tid !== user.tenantId) return;

      const entity = String(evt.entity || '');

      if (entity === 'admin-staff-test-push') {
        if (!isSchoolStaff) return;
        const title = String(evt.title || 'School message');
        const body = String(evt.body || '').trim();
        if (!body) return;
        const at = Number(evt.at) || Date.now();
        const id = `push-test-${at}-${title.slice(0, 24)}`;
        pushItem({ id, kind: 'admin', title, body, at, read: false });
        showOnScreenNotification(title, body, 'violet');
        return;
      }

      if (entity === 'school-staff-notice' || entity === 'teacher-admin-notice') {
        if (!isSchoolStaff) return;
        const title = String(evt.title || 'School message');
        const body = String(evt.body || '').trim();
        if (!body) return;
        const at = Number(evt.at) || Date.now();
        const id = `admin-${at}-${title.slice(0, 24)}-${body.slice(0, 40)}`;
        pushItem({ id, kind: 'admin', title, body, at, read: false });
        showOnScreenNotification(title, body, 'indigo');
        return;
      }

      if (entity === 'salary-payment') {
        if (!isSchoolStaff) return;
        const payeeType = String(evt.payee_type || '');
        const payeeId = Number(evt.payee_id);
        if (!payeeId || Number.isNaN(payeeId)) return;

        const myTeacherId = user.teacherId != null && user.teacherId !== '' ? Number(user.teacherId) : NaN;
        const myStaffId = user.otherStaffId != null ? Number(user.otherStaffId) : NaN;

        const forMe =
          ((user.role === 'teacher' || user.role === 'headmaster') &&
            payeeType === 'teacher' &&
            !Number.isNaN(myTeacherId) &&
            myTeacherId === payeeId) ||
          (user.role === 'staff' && payeeType === 'staff' && !Number.isNaN(myStaffId) && myStaffId === payeeId);

        if (!forMe) return;

        const month = Number(evt.month);
        const year = Number(evt.year);
        const amount = Number(evt.amount);
        const period =
          !Number.isNaN(month) && !Number.isNaN(year)
            ? new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
            : 'your account';
        const amtStr = !Number.isNaN(amount)
          ? `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          : '';
        const title = String(evt.title || 'Salary paid');
        const body = String(
          evt.body || (amtStr ? `Payment for ${period}: ${amtStr}.` : `A salary payment was recorded for ${period}.`)
        );
        const at = Number(evt.at) || Date.now();
        const id = `salary-${payeeId}-${month}-${year}-${at}`;
        pushItem({ id, kind: 'salary', title, body, at, read: false });
        showOnScreenNotification(title, body, 'emerald');
      }
    };

    const onNewSupportMessage = (msg: Record<string, unknown>) => {
      if (!isSuperAdmin) return;

      const preview = String(msg.message || 'New support message').trim();
      if (!preview) return;
      const at = Date.now();
      const fromSuper = Boolean(msg.is_from_superadmin);
      const tenantName = String(msg.tenant_name || 'School');

      if (fromSuper) return;

      const title = `${tenantName} — Support message`;
      const id = `sa-support-${msg.id ?? at}`;
      pushItem({ id, kind: 'support-chat', title, body: preview, at, read: false });
      showOnScreenNotification(title, preview, 'sky');
    };

    socket.on('tenant-data-changed', onTenant);
    socket.on('new-support-message', onNewSupportMessage);

    return () => {
      socket.off('tenant-data-changed', onTenant);
      socket.off('new-support-message', onNewSupportMessage);
    };
  }, [socket, isRecipient, isSchoolStaff, isSuperAdmin, user, pushItem]);

  const visibleItems = useMemo(() => filterItemsForRole(user?.role, items), [items, user?.role]);
  const unreadCount = useMemo(() => visibleItems.filter((i) => !i.read).length, [visibleItems]);

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
    () => ({ items: visibleItems, unreadCount, markRead, markAllRead, dismiss }),
    [visibleItems, unreadCount, markRead, markAllRead, dismiss]
  );

  return <TeacherNotificationContext.Provider value={value}>{children}</TeacherNotificationContext.Provider>;
};

export function useTeacherNotifications() {
  const ctx = useContext(TeacherNotificationContext);
  if (!ctx) throw new Error('useTeacherNotifications must be used within TeacherNotificationProvider');
  return ctx;
}
