import { useEffect } from 'react';

const LIVE_INTERVAL_MS = 12_000;

/** Silent background refresh — keeps the portal feeling live while the tab is open. */
export function usePartnerLiveSync(refresh: () => Promise<void>, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState === 'visible') {
        void refresh();
      }
    };

    const id = window.setInterval(tick, LIVE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, enabled]);
}
