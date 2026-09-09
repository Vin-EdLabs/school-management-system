import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveApiBaseUrl } from '../services/api';

/** Effective connection types from the Network Information API. */
export type NetworkEffectiveType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';

export interface NetworkStatus {
  isOnline: boolean;
  isLowData: boolean;
  /** True when a lightweight health ping exceeds the slow threshold or fails. */
  isSlowResponse: boolean;
  connectionType: NetworkEffectiveType;
  /** Estimated downlink speed in Mbps, or null when unavailable. */
  downlink: number | null;
  /** Re-run the connectivity ping immediately. */
  retryPing: () => void;
}

interface NetworkInformation extends EventTarget {
  readonly effectiveType?: NetworkEffectiveType;
  readonly downlink?: number;
  readonly saveData?: boolean;
  addEventListener(type: 'change', listener: () => void): void;
  removeEventListener(type: 'change', listener: () => void): void;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
  mozConnection?: NetworkInformation;
  webkitConnection?: NetworkInformation;
}

const LOW_DATA_EFFECTIVE_TYPES = new Set<NetworkEffectiveType>(['slow-2g', '2g']);
const LOW_DOWNLINK_MBPS = 0.5;
const PING_SLOW_MS = 4000;
const PING_INTERVAL_MS = 45_000;

function getNetworkConnection(): NetworkInformation | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const nav = navigator as NavigatorWithConnection;
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection;
}

function readConnectionSnapshot(conn: NetworkInformation | undefined): Pick<
  NetworkStatus,
  'isLowData' | 'connectionType' | 'downlink'
> {
  const effectiveType = conn?.effectiveType ?? 'unknown';
  const downlink =
    typeof conn?.downlink === 'number' && Number.isFinite(conn.downlink)
      ? conn.downlink
      : null;

  const isLowByType = LOW_DATA_EFFECTIVE_TYPES.has(effectiveType);
  const isLowBySpeed = downlink != null && downlink < LOW_DOWNLINK_MBPS;
  const saveData = conn?.saveData === true;

  return {
    connectionType: effectiveType,
    downlink,
    isLowData: isLowByType || isLowBySpeed || saveData,
  };
}

function resolveHealthPingUrl(): string {
  const base = resolveApiBaseUrl();
  const origin = base.replace(/\/api\/?$/, '');
  return `${origin}/api/health`;
}

async function pingHealth(signal: AbortSignal): Promise<{ ok: boolean; slow: boolean }> {
  const started = performance.now();
  try {
    const response = await fetch(resolveHealthPingUrl(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      signal,
    });
    const elapsed = performance.now() - started;
    return { ok: response.ok, slow: elapsed >= PING_SLOW_MS };
  } catch {
    return { ok: false, slow: true };
  }
}

/**
 * Tracks browser online/offline state, low-bandwidth hints, and slow server responses.
 */
export function useNetworkStatus(options?: { enablePing?: boolean }): NetworkStatus {
  const enablePing = options?.enablePing !== false;

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [connectionSnapshot, setConnectionSnapshot] = useState(() =>
    readConnectionSnapshot(getNetworkConnection())
  );
  const [isSlowResponse, setIsSlowResponse] = useState(false);
  const pingGeneration = useRef(0);

  const syncConnection = useCallback(() => {
    setConnectionSnapshot(readConnectionSnapshot(getNetworkConnection()));
  }, []);

  const runPing = useCallback(async () => {
    if (!enablePing || typeof window === 'undefined') return;
    if (!navigator.onLine) {
      setIsSlowResponse(true);
      return;
    }

    const gen = ++pingGeneration.current;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), PING_SLOW_MS + 1500);

    try {
      const result = await pingHealth(controller.signal);
      if (gen !== pingGeneration.current) return;
      setIsSlowResponse(!result.ok || result.slow);
    } finally {
      window.clearTimeout(timeout);
    }
  }, [enablePing]);

  const retryPing = useCallback(() => {
    void runPing();
  }, [runPing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncConnection();
      void runPing();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setIsSlowResponse(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const conn = getNetworkConnection();
    conn?.addEventListener('change', syncConnection);

    void runPing();
    const interval = enablePing ? window.setInterval(runPing, PING_INTERVAL_MS) : undefined;

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      conn?.removeEventListener('change', syncConnection);
      if (interval != null) window.clearInterval(interval);
      pingGeneration.current++;
    };
  }, [enablePing, runPing, syncConnection]);

  return {
    isOnline,
    isLowData: connectionSnapshot.isLowData,
    isSlowResponse,
    connectionType: connectionSnapshot.connectionType,
    downlink: connectionSnapshot.downlink,
    retryPing,
  };
}

/** Convenience helper for non-hook contexts (e.g. fetch wrappers). */
export function isNetworkLikelyConstrained(): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const snapshot = readConnectionSnapshot(getNetworkConnection());
  return snapshot.isLowData;
}
