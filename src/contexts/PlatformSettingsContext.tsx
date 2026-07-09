import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiService } from '@/services/api';
import {
  fetchPublicPlatformUi,
  readCachedPlatformUi,
  writeCachedPlatformUi,
  type PlatformUiSettings,
} from '@/utils/platformUiSettings';

type PlatformSettingsContextValue = {
  ui: PlatformUiSettings;
  loaded: boolean;
  refresh: () => Promise<void>;
};

const OFF_UI: PlatformUiSettings = { zoomNudgeEnabled: false };

const PlatformSettingsContext = createContext<PlatformSettingsContextValue | undefined>(undefined);

export const PlatformSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const cached = readCachedPlatformUi();
  const [ui, setUi] = useState<PlatformUiSettings>(cached ?? OFF_UI);
  const [loaded, setLoaded] = useState(false);

  const applyUi = useCallback((next: PlatformUiSettings) => {
    setUi({ zoomNudgeEnabled: next.zoomNudgeEnabled === true });
    writeCachedPlatformUi(next);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchPublicPlatformUi(apiService.getBaseUrl());
      applyUi(next);
    } catch {
      const fallback = readCachedPlatformUi();
      if (fallback) applyUi(fallback);
      else applyUi(OFF_UI);
    } finally {
      setLoaded(true);
    }
  }, [applyUi]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (authLoading) return;
    if (isAuthenticated) void refresh();
  }, [authLoading, isAuthenticated, refresh]);

  useEffect(() => {
    const onChanged = (event: Event) => {
      const detail = (event as CustomEvent<PlatformUiSettings>).detail;
      if (detail && typeof detail.zoomNudgeEnabled === 'boolean') {
        applyUi(detail);
        setLoaded(true);
        return;
      }
      void refresh();
    };
    const onFocus = () => void refresh();
    window.addEventListener('platform-settings-changed', onChanged);
    window.addEventListener('focus', onFocus);
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.removeEventListener('platform-settings-changed', onChanged);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [applyUi, refresh]);

  const value = useMemo(
    () => ({ ui, loaded, refresh }),
    [ui, loaded, refresh]
  );

  return <PlatformSettingsContext.Provider value={value}>{children}</PlatformSettingsContext.Provider>;
};

export function usePlatformSettings() {
  const ctx = useContext(PlatformSettingsContext);
  if (!ctx) throw new Error('usePlatformSettings must be used within PlatformSettingsProvider');
  return ctx;
}

export function useOptionalPlatformSettings() {
  return useContext(PlatformSettingsContext);
}
