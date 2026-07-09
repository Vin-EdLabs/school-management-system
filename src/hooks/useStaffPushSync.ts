import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOptionalSchool } from '../contexts/SchoolContext';
import { apiService } from '../services/api';
import { urlBase64ToUint8Array } from '../utils/pushSubscription';

const PUSH_ROLES = new Set(['teacher', 'staff', 'headmaster', 'administrator', 'finance', 'super-admin']);

/**
 * Registers web push for school staff and super-admin sessions.
 */
export function useStaffPushSync() {
  const { user, isAuthenticated } = useAuth();
  const schoolContext = useOptionalSchool();
  const schoolId = schoolContext?.schoolId ?? null;
  const syncedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    const role = String(user.role || '').toLowerCase();
    if (!PUSH_ROLES.has(role)) return;
    if (role !== 'super-admin' && !schoolId) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const key = `${user.id}-${schoolId ?? 'platform'}`;
    if (syncedKey.current === key) return;

    const run = async () => {
      try {
        if (schoolId != null) apiService.setTenantContext(schoolId);
        const perm =
          Notification.permission === 'default'
            ? await Notification.requestPermission().catch(() => 'default' as NotificationPermission)
            : Notification.permission;
        if (perm !== 'granted') return;

        const swReg = await navigator.serviceWorker.ready;
        const keyRes = await apiService.get<{ publicKey?: string }>('/auth/push/public-key').catch(() => null);
        const publicKey = keyRes?.publicKey;
        if (!publicKey) return;

        let subscription = await swReg.pushManager.getSubscription();
        if (!subscription) {
          subscription = await swReg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        await apiService.post('/auth/push/subscribe', subscription.toJSON() as unknown as Record<string, unknown>);
        syncedKey.current = key;
      } catch {
        // VAPID missing, user denied, or network — ignore
      }
    };

    void run();
  }, [isAuthenticated, user, schoolId]);
}
