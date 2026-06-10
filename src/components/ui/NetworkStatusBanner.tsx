import React, { useEffect, useRef, useState } from 'react';
import { SignalLow, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

type AlertMode = 'offline' | 'low-data' | 'slow';

const AUTO_DISMISS_MS = 5000;

const ALERT_COPY: Record<AlertMode, string> = {
  offline: 'No internet connection',
  'low-data': 'Slow connection',
  slow: 'Connection is slow',
};

function resolveAlertMode(
  isOnline: boolean,
  isLowData: boolean,
  isSlowResponse: boolean
): AlertMode | null {
  if (!isOnline) return 'offline';
  if (isLowData) return 'low-data';
  if (isSlowResponse) return 'slow';
  return null;
}

/**
 * Tiny transient network hint — flashes for 5s on load/refresh or when status worsens,
 * then slides away without blocking the UI.
 */
export function NetworkStatusBanner() {
  const { isOnline, isLowData, isSlowResponse } = useNetworkStatus({ enablePing: true });
  const currentMode = resolveAlertMode(isOnline, isLowData, isSlowResponse);

  const [visible, setVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState<AlertMode | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();
  const prevModeRef = useRef<AlertMode | null | undefined>(undefined);
  const mountedRef = useRef(false);

  const hideToast = () => {
    setVisible(false);
  };

  const showToast = (mode: AlertMode) => {
    setDisplayMode(mode);
    setVisible(true);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(hideToast, AUTO_DISMISS_MS);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  // Show on refresh/mount when issue exists, or when connectivity worsens mid-session.
  useEffect(() => {
    if (!currentMode) {
      prevModeRef.current = null;
      return;
    }

    const isFirstCheck = prevModeRef.current === undefined;
    const worsened = prevModeRef.current !== currentMode;

    if (isFirstCheck || worsened) {
      showToast(currentMode);
    }

    prevModeRef.current = currentMode;
  }, [currentMode]);

  // If connection recovers while toast is still up, dismiss early.
  useEffect(() => {
    if (!currentMode && visible) {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      hideToast();
    }
  }, [currentMode, visible]);

  if (!displayMode) return null;

  const message = ALERT_COPY[displayMode];

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-1/2 top-[max(0.75rem,env(safe-area-inset-top))] z-[200] -translate-x-1/2',
        'transition-all duration-300 ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
      )}
      aria-hidden={!visible}
    >
      <div
        role="alert"
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur-sm',
          displayMode === 'offline' &&
            'border-red-200/60 bg-red-950/90 text-red-100 dark:border-red-900/50',
          displayMode === 'low-data' &&
            'border-amber-300/50 bg-amber-500/90 text-amber-950',
          displayMode === 'slow' &&
            'border-slate-600/40 bg-slate-800/90 text-slate-200'
        )}
      >
        {displayMode === 'offline' ? (
          <WifiOff className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        ) : (
          <SignalLow className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
        )}
        <span className="whitespace-nowrap">{message}</span>
      </div>
    </div>
  );
}

export default NetworkStatusBanner;
