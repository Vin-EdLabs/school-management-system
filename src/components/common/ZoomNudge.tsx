import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Monitor, X, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useOptionalPlatformSettings } from '@/contexts/PlatformSettingsContext';
import {
  isComfortableZoom,
  isTriggerZoom,
  shouldShowOnLogin,
} from '@/utils/browserZoom';

const LOGIN_PENDING_KEY = 'scholarnerve-zoom-nudge-login';
const COMFORTABLE_KEY = 'scholarnerve-zoom-nudge-comfortable';

function isTouchDevice(): boolean {
  return typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
}

function isMacOs(): boolean {
  if (typeof navigator === 'undefined') return false;
  const platform = navigator.platform || '';
  const ua = navigator.userAgent || '';
  return /Mac|iPhone|iPad|iPod/i.test(platform) || /Mac OS X/i.test(ua);
}

function isComfortableSatisfied(): boolean {
  try {
    return sessionStorage.getItem(COMFORTABLE_KEY) === '1';
  } catch {
    return false;
  }
}

function markComfortableSatisfied(): void {
  try {
    sessionStorage.setItem(COMFORTABLE_KEY, '1');
  } catch {
    /* ignore */
  }
}

function consumeLoginPending(): boolean {
  try {
    if (sessionStorage.getItem(LOGIN_PENDING_KEY) !== '1') return false;
    sessionStorage.removeItem(LOGIN_PENDING_KEY);
    return true;
  } catch {
    return false;
  }
}

function isEligibleViewport(): boolean {
  if (typeof window === 'undefined') return false;
  if (isTouchDevice()) return false;
  if (window.innerWidth < 1024) return false;
  return true;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-0.5 inline-flex items-center rounded-md border border-slate-600 bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
      {children}
    </kbd>
  );
}

export const ZoomNudge: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const platformSettings = useOptionalPlatformSettings();
  const zoomNudgeEnabled =
    platformSettings?.loaded === true && platformSettings.ui.zoomNudgeEnabled === true;
  const [visible, setVisible] = useState(false);
  const mac = isMacOs();
  const dismissedWhileInTrigger = useRef(false);
  const wasInTrigger = useRef(false);
  const bootstrapped = useRef(false);

  const evaluate = useCallback(() => {
    if (!zoomNudgeEnabled) {
      setVisible(false);
      return;
    }

    if (!isEligibleViewport()) {
      bootstrapped.current = false;
      wasInTrigger.current = false;
      dismissedWhileInTrigger.current = false;
      setVisible(false);
      return;
    }

    const trigger = isTriggerZoom();
    const comfortable = isComfortableZoom();

    if (comfortable) {
      markComfortableSatisfied();
      dismissedWhileInTrigger.current = false;
      wasInTrigger.current = false;
      setVisible(false);
      return;
    }

    if (isComfortableSatisfied() && !trigger) {
      wasInTrigger.current = false;
      setVisible(false);
      return;
    }

    if (isComfortableSatisfied() && trigger) {
      try {
        sessionStorage.removeItem(COMFORTABLE_KEY);
      } catch {
        /* ignore */
      }
    }

    if (!bootstrapped.current) {
      bootstrapped.current = true;
      wasInTrigger.current = trigger;
      const loginPending = consumeLoginPending();
      if (loginPending && shouldShowOnLogin() && !dismissedWhileInTrigger.current) {
        setVisible(true);
        return;
      }
      setVisible(false);
      return;
    }

    if (!trigger) {
      if (wasInTrigger.current) dismissedWhileInTrigger.current = false;
      wasInTrigger.current = false;
      setVisible(false);
      return;
    }

    wasInTrigger.current = true;

    if (dismissedWhileInTrigger.current) {
      setVisible(false);
      return;
    }

    setVisible(true);
  }, [zoomNudgeEnabled]);

  useEffect(() => {
    if (!isAuthenticated || loading) return;
    if (!zoomNudgeEnabled) {
      setVisible(false);
      return;
    }

    bootstrapped.current = false;
    wasInTrigger.current = false;
    dismissedWhileInTrigger.current = false;
    setVisible(false);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(evaluate, 150);
    };

    const boot = window.setTimeout(evaluate, 500);

    window.addEventListener('resize', schedule);
    const vv = window.visualViewport;
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);

    const poll = window.setInterval(evaluate, 2000);

    return () => {
      window.clearTimeout(boot);
      if (timer) clearTimeout(timer);
      window.clearInterval(poll);
      window.removeEventListener('resize', schedule);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [isAuthenticated, loading, evaluate, zoomNudgeEnabled]);

  const dismiss = () => {
    dismissedWhileInTrigger.current = true;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Browser zoom tip"
      className="fixed bottom-5 right-5 z-[90] w-[min(100vw-2rem,24rem)] animate-in fade-in slide-in-from-bottom-3 duration-300"
    >
      <div className="rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 shadow-2xl shadow-black/40 ring-1 ring-emerald-500/20 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ZoomOut className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-100">Tip for desktop viewing</p>
              <button
                type="button"
                onClick={dismiss}
                className="shrink-0 rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-slate-400">
              For the best experience — especially in <span className="font-medium text-slate-300">Markbook</span> —
              zoom out to <span className="font-medium text-slate-300">80%</span> or{' '}
              <span className="font-medium text-slate-300">90%</span> using:
            </p>
            <div className="space-y-1 rounded-xl border border-slate-700/60 bg-slate-800/40 px-3 py-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <Keyboard className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                <span>
                  Windows: <Kbd>Ctrl</Kbd> + <Kbd>−</Kbd>
                </span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                <span>
                  Mac: <Kbd>Cmd</Kbd> + <Kbd>−</Kbd>
                </span>
              </div>
              {mac && (
                <p className="pt-0.5 text-[10px] text-slate-500">Your device uses the Mac shortcut.</p>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Monitor className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>Desktop only · hides when you reach 80% or 90% zoom</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={dismiss}
              className="mt-1 h-8 w-full rounded-xl bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Got it
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZoomNudge;
