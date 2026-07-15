/** Keep the installed PWA home-screen badge in sync with in-app unread counts. */
export function syncPwaAppBadge(count: number): void {
  if (typeof window === 'undefined') return;
  const safe = Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0);

  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  if (typeof nav.setAppBadge === 'function') {
    if (safe > 0) {
      nav.setAppBadge(safe).catch(() => undefined);
    } else if (typeof nav.clearAppBadge === 'function') {
      nav.clearAppBadge().catch(() => undefined);
    } else {
      nav.setAppBadge(0).catch(() => undefined);
    }
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.active?.postMessage({ type: 'SET_BADGE_COUNT', count: safe });
      })
      .catch(() => undefined);
  }
}
