import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  IMPERSONATION_TRANSITION_MS,
  readImpersonationTransition,
} from '../../utils/impersonationHelpers';

type Props = {
  message: string;
  phase?: 'enter' | 'exit';
};

const ENTER_STEPS = [
  'Securing session…',
  'Loading profile…',
  'Preparing dashboard…',
  'Almost ready…',
];

const EXIT_STEPS = [
  'Wrapping up…',
  'Restoring admin access…',
  'Syncing your workspace…',
  'Welcome back…',
];

/** Premium full-screen loader while switching impersonation sessions */
const ImpersonationTransitionOverlay: React.FC<Props> = ({ message, phase = 'enter' }) => {
  const [progress, setProgress] = useState(0);
  const [subMessage, setSubMessage] = useState(phase === 'enter' ? ENTER_STEPS[0] : EXIT_STEPS[0]);
  const steps = phase === 'exit' ? EXIT_STEPS : ENTER_STEPS;

  useEffect(() => {
    const active = readImpersonationTransition();
    const durationMs = active?.durationMs ?? IMPERSONATION_TRANSITION_MS;
    const start = active?.startedAt ?? Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / durationMs) * 100);
      setProgress(pct);
      const idx = Math.min(steps.length - 1, Math.floor((elapsed / durationMs) * steps.length));
      setSubMessage(steps[idx]);
    };
    tick();
    const interval = window.setInterval(tick, 60);
    return () => window.clearInterval(interval);
  }, [phase, steps]);

  return createPortal(
    <div className="fixed inset-0 z-[10070] flex items-center justify-center bg-gradient-to-br from-slate-950/75 via-amber-950/40 to-slate-950/80 backdrop-blur-md animate-in fade-in duration-500">
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(251,191,36,0.35), transparent 45%), radial-gradient(circle at 70% 80%, rgba(168,85,247,0.25), transparent 40%)',
        }}
      />
      <div className="relative mx-4 w-full max-w-sm animate-in zoom-in-95 fade-in duration-500">
        <div className="overflow-hidden rounded-3xl border border-white/15 bg-white/95 shadow-[0_32px_80px_rgba(0,0,0,0.45)] dark:bg-slate-900/95">
          <div className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-violet-500/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/30">
                <ShieldCheck className="h-6 w-6 text-amber-950" />
                <Sparkles className="absolute -right-1 -top-1 h-4 w-4 text-amber-200 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{message}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{subMessage}</p>
              </div>
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-500" />
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              <span>{phase === 'exit' ? 'Returning' : 'Switching view'}</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/80">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-violet-500 transition-[width] duration-150 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
              Please wait — your session is being prepared securely
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImpersonationTransitionOverlay;
