import React, { useCallback, useEffect, useRef } from 'react';

/**
 * Activates a waiting service worker and reloads once (same smooth behavior as parent portal).
 * No modal/banner — when a new build is waiting, we skip waiting so the page refreshes on controller change.
 */
export function PwaUpdateManager() {
  const waitingRef = useRef<ServiceWorker | null>(null);
  const reloadOnceRef = useRef(false);
  const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activateWaitingWorker = useCallback(() => {
    const w = waitingRef.current;
    if (!w || !navigator.serviceWorker.controller) return;
    w.postMessage({ type: 'SKIP_WAITING' });
  }, []);

  const scheduleActivate = useCallback(() => {
    if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    applyTimerRef.current = window.setTimeout(() => {
      applyTimerRef.current = null;
      activateWaitingWorker();
    }, 400);
  }, [activateWaitingWorker]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onControllerChange = () => {
      if (reloadOnceRef.current) return;
      reloadOnceRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    let interval: ReturnType<typeof setInterval> | undefined;

    const considerWaiting = (reg: ServiceWorkerRegistration) => {
      const w = reg.waiting;
      if (!w || !navigator.serviceWorker.controller) return;
      waitingRef.current = w;
      scheduleActivate();
    };

    const attach = (reg: ServiceWorkerRegistration) => {
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed') considerWaiting(reg);
        });
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      considerWaiting(reg);
      attach(reg);
      reg.update().catch(() => undefined);
      interval = window.setInterval(() => reg.update().catch(() => undefined), 15 * 60 * 1000);
    });

    const onVisibility = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        if (document.visibilityState === 'visible') {
          reg.update().catch(() => undefined);
          const w = reg.waiting;
          if (w && navigator.serviceWorker.controller) {
            waitingRef.current = w;
            scheduleActivate();
          }
          return;
        }
        const w = reg.waiting;
        if (w && navigator.serviceWorker.controller) {
          waitingRef.current = w;
          w.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onWindowFocus = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        reg?.update().catch(() => undefined);
        const w = reg?.waiting;
        if (w && navigator.serviceWorker.controller) {
          waitingRef.current = w;
          scheduleActivate();
        }
      });
    };
    window.addEventListener('focus', onWindowFocus);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onWindowFocus);
      if (interval) clearInterval(interval);
      if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    };
  }, [scheduleActivate]);

  return null;
}
