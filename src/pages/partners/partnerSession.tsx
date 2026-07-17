import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { PartnerActivityItem, PartnerApiError, PartnerProfile, PartnerStats,
  getPartnerToken, partnerApi, setPartnerToken,
} from '@/services/partnerApi';

export type PartnerSession = {
  partner: PartnerProfile;
  stats: PartnerStats;
  recentActivity: PartnerActivityItem[];
  refresh: () => Promise<void>;
  markNotificationsRead: () => void;
  markNotificationRead: (id: number) => void;
  logout: () => void;
};

export type MeResponse = {
  partner: PartnerProfile;
  stats: PartnerStats;
  recentActivity?: PartnerActivityItem[];
};

const PartnerSessionContext = createContext<PartnerSession | null>(null);

const SESSION_CACHE_KEY = 'snpPartnerSessionCache';
const SESSION_CACHE_MS = 45_000;

type SessionCache = {
  token: string;
  at: number;
  partner: PartnerProfile;
  stats: PartnerStats;
  recentActivity: PartnerActivityItem[];
};

export function readPartnerSessionCache(): SessionCache | null {
  try {
    const raw = sessionStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionCache;
    const token = getPartnerToken();
    if (!token || parsed.token !== token) return null;
    if (Date.now() - parsed.at > SESSION_CACHE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writePartnerSessionCache(data: {
  partner: PartnerProfile;
  stats: PartnerStats;
  recentActivity: PartnerActivityItem[];
}) {
  const token = getPartnerToken();
  if (!token) return;
  try {
    sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      token,
      at: Date.now(),
      ...data,
    } satisfies SessionCache));
  } catch {
    /* quota */
  }
}

export function clearPartnerSessionCache() {
  try {
    sessionStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function usePartnerSession(): PartnerSession {
  const ctx = useContext(PartnerSessionContext);
  if (!ctx) throw new Error('usePartnerSession must be used inside the partner portal');
  return ctx;
}

export function PartnerSessionContextProvider({
  value,
  children,
}: {
  value: PartnerSession;
  children: React.ReactNode;
}) {
  return (
    <PartnerSessionContext.Provider value={value}>
      {children}
    </PartnerSessionContext.Provider>
  );
}

export function usePartnerSessionState() {
  const [initialCache] = useState(() => readPartnerSessionCache());
  const [checking, setChecking] = useState(!initialCache);
  const [partner, setPartner] = useState<PartnerProfile | null>(initialCache?.partner ?? null);
  const [stats, setStats] = useState<PartnerStats | null>(initialCache?.stats ?? null);
  const [recentActivity, setRecentActivity] = useState<PartnerActivityItem[]>(initialCache?.recentActivity ?? []);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const loadRef = useRef(0);
  const hasSessionRef = useRef(!!initialCache);
  const hadCacheRef = useRef(!!initialCache);

  useEffect(() => {
    hasSessionRef.current = !!(partner && stats);
  }, [partner, stats]);

  const applySession = useCallback((result: MeResponse) => {
    setPartner(result.partner);
    setStats(result.stats);
    setRecentActivity(result.recentActivity || []);
    writePartnerSessionCache({
      partner: result.partner,
      stats: result.stats,
      recentActivity: result.recentActivity || [],
    });
  }, []);

  const loadSession = useCallback(async (opts?: { silent?: boolean }) => {
    const loadId = ++loadRef.current;
    if (!getPartnerToken()) {
      setPartner(null);
      setStats(null);
      setRecentActivity([]);
      setSessionError(null);
      clearPartnerSessionCache();
      if (!opts?.silent) setChecking(false);
      return;
    }
    if (!opts?.silent) setSessionError(null);
    try {
      const result = await partnerApi.get<MeResponse>('/partners/me');
      if (loadId !== loadRef.current) return;
      applySession(result);
      setSessionError(null);
    } catch (err) {
      if (loadId !== loadRef.current) return;
      if (err instanceof PartnerApiError && (err.status === 401 || err.status === 403)) {
        setPartnerToken(null);
        setPartner(null);
        setStats(null);
        setRecentActivity([]);
        setSessionError(null);
        clearPartnerSessionCache();
      } else if (getPartnerToken() && !hasSessionRef.current) {
        setSessionError('Could not load your account. Check your connection and try again.');
      }
    } finally {
      if (loadId === loadRef.current && !opts?.silent) setChecking(false);
    }
  }, [applySession]);

  useEffect(() => {
    const hashMatch = window.location.hash.match(/token=([^&]+)/);
    if (hashMatch) {
      setPartnerToken(decodeURIComponent(hashMatch[1]));
      window.history.replaceState(null, '', window.location.pathname);
      clearPartnerSessionCache();
      hadCacheRef.current = false;
    }
    void loadSession({ silent: hadCacheRef.current });
  }, [loadSession]);

  const markNotificationsRead = useCallback(() => {
    setStats((prev) => {
      if (!prev || prev.unreadNotifications === 0) return prev;
      const next = { ...prev, unreadNotifications: 0 };
      setPartner((p) => {
        if (p) writePartnerSessionCache({ partner: p, stats: next, recentActivity });
        return p;
      });
      return next;
    });
    void partnerApi.put('/partners/notifications/read-all').catch(() => undefined);
  }, [recentActivity]);

  const markNotificationRead = useCallback((id: number) => {
    setStats((prev) => {
      if (!prev || prev.unreadNotifications <= 0) return prev;
      const next = { ...prev, unreadNotifications: Math.max(0, prev.unreadNotifications - 1) };
      setPartner((p) => {
        if (p) writePartnerSessionCache({ partner: p, stats: next, recentActivity });
        return p;
      });
      return next;
    });
    void partnerApi.put(`/partners/notifications/${id}/read`).catch(() => undefined);
  }, [recentActivity]);

  const resetSession = useCallback(() => {
    setPartner(null);
    setStats(null);
    setRecentActivity([]);
    setSessionError(null);
    clearPartnerSessionCache();
  }, []);

  return {
    checking,
    partner,
    stats,
    recentActivity,
    sessionError,
    loadSession,
    setChecking,
    markNotificationsRead,
    markNotificationRead,
    resetSession,
  };
}
