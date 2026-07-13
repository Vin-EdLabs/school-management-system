import React, { useEffect } from 'react';

/**
 * Checks for service worker updates in the background.
 * Does not reload the active session — updates apply on the next cold start.
 */
export function PwaUpdateManager() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const host = window.location.hostname;
    const isDevHost =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.endsWith('.localhost') ||
      host.endsWith('.lvh.me');
    if (isDevHost) return;

    const check = () => {
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update().catch(() => undefined));
    };

    check();
    const interval = window.setInterval(check, 60 * 60 * 1000);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
