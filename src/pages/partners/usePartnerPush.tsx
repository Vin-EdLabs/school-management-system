import React, { useEffect, useRef, useState } from 'react';
import { getPartnerToken, partnerApi } from '@/services/partnerApi';
import { getFcmToken } from '@/services/firebase';
import { urlBase64ToUint8Array } from '@/utils/pushSubscription';

const DISMISS_KEY = 'snPartnerPushDismissed';
const FIREBASE_WEB_PUSH_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';

async function subscribePartnerWebPush(): Promise<boolean> {
  const swReg = await navigator.serviceWorker.ready;
  const keyRes = await partnerApi.get<{ publicKey?: string }>('/partners/push/public-key');
  const publicKey = keyRes?.publicKey;
  if (!publicKey) return false;

  let subscription = await swReg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await swReg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await partnerApi.post('/partners/push/subscribe', subscription.toJSON() as unknown as Record<string, unknown>);
  return true;
}

async function subscribePartnerFcm(): Promise<void> {
  if (!FIREBASE_WEB_PUSH_VAPID_KEY) return;
  const fcmToken = await getFcmToken(FIREBASE_WEB_PUSH_VAPID_KEY).catch(() => null);
  if (!fcmToken) return;
  await partnerApi.post('/partners/push/fcm-token', { token: fcmToken }).catch(() => undefined);
}

/** Register web push + FCM — same dual path as the parent portal for reliable phone alerts. */
export async function ensurePartnerPushSubscription(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (!getPartnerToken()) return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return false;

  try {
    await subscribePartnerWebPush();
    await subscribePartnerFcm();
    return true;
  } catch {
    return false;
  }
}

/** Ask for permission (if needed) and register this device for partner push alerts. */
export async function enablePartnerPushNotifications(): Promise<boolean> {
  return ensurePartnerPushSubscription();
}

/** Registers push when permission is already granted; re-syncs periodically like parent portal. */
export function usePartnerPushSync(enabled: boolean) {
  const synced = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (!getPartnerToken()) return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const sync = () => {
      if (Notification.permission !== 'granted') return;
      void ensurePartnerPushSubscription()
        .then((ok) => {
          if (ok) synced.current = true;
        })
        .catch(() => undefined);
    };

    sync();
    const id = window.setInterval(sync, 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);
}

export function PartnerPushPrompt() {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true;
    if (localStorage.getItem(DISMISS_KEY) === '1') return true;
    if (!('Notification' in window)) return true;
    return Notification.permission !== 'default';
  });

  if (hidden) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setHidden(true);
  };

  const enable = async () => {
    const ok = await ensurePartnerPushSubscription();
    if (ok || Notification.permission !== 'default') {
      dismiss();
    }
  };

  return (
    <div className="snp-push-prompt snp-fade-up mx-4 mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-slate-900 md:mx-6">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-emerald-900 dark:text-emerald-100">Turn on push alerts</p>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Get pop-up alerts on your phone for approvals, demo links, commissions, and payouts — even when the app is closed.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => void enable()}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          Enable alerts
        </button>
      </div>
    </div>
  );
}
