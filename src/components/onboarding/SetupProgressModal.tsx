import React, { useCallback, useEffect, useId, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Check, Circle, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { resolveLogoUrl } from '@/services/tenantService';
import { useSchool } from '@/contexts/SchoolContext';
import type { SetupStep } from '@/hooks/useSetupProgress';

const DISMISS_KEY_PREFIX = 'scholarnerve_setup_later_';

export type SetupProgressModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  steps: SetupStep[];
  isComplete: boolean;
  completedCount: number;
  totalSteps: number;
  onNavigate: (moduleId: string) => void;
  onDismissForSession: () => void;
};

const SetupProgressModal: React.FC<SetupProgressModalProps> = ({
  open,
  onOpenChange,
  steps,
  isComplete,
  completedCount,
  totalSteps,
  onNavigate,
  onDismissForSession,
}) => {
  const { school } = useSchool();
  const titleId = useId();
  const descId = useId();
  const progressPct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const logoUrl = resolveLogoUrl(school?.logo_url ?? null);
  const schoolName = school?.name || 'your school';

  const handleLater = useCallback(() => {
    onDismissForSession();
    onOpenChange(false);
  }, [onDismissForSession, onOpenChange]);

  const handleSetup = useCallback(
    (step: SetupStep) => {
      onNavigate(step.route);
      onOpenChange(false);
    },
    [onNavigate, onOpenChange]
  );

  if (isComplete) return null;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          aria-hidden
        />
        <DialogPrimitive.Content
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2',
            'rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl',
            'duration-300 data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[state=closed]:scale-95 data-[state=open]:scale-100',
            'focus:outline-none dark:border-slate-700 dark:bg-slate-900'
          )}
          onEscapeKeyDown={() => handleLater()}
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <div className="mb-6 flex flex-col items-center text-center">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="mb-4 h-14 w-14 rounded-xl border border-slate-200 object-cover shadow-sm dark:border-slate-700"
              />
            ) : (
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
                <GraduationCap className="h-7 w-7" aria-hidden />
              </div>
            )}
            <h2 id={titleId} className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Welcome to SCHOLARNERVE
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{schoolName}</p>
            <p id={descId} className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Complete a few quick steps to get your school ready.
            </p>
          </div>

          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {completedCount} of {totalSteps} complete
              </span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#146C43] via-[#16A34A] to-[#22C55E] transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          <ul className="space-y-2" role="list">
            {steps.map((step) => (
              <li
                key={step.key}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                  step.done
                    ? 'border-slate-100 bg-slate-50/80 opacity-70 dark:border-slate-800 dark:bg-slate-800/40'
                    : 'border-slate-200/80 bg-white hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/50 dark:hover:bg-slate-800/50'
                )}
              >
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2',
                    step.done
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-slate-200 bg-white text-slate-300 dark:border-slate-600 dark:bg-slate-900'
                  )}
                  aria-hidden
                >
                  {step.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {step.done ? (
                  <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    Done
                  </span>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 border-emerald-600/30 text-emerald-800 hover:bg-emerald-50 dark:text-emerald-200"
                    onClick={() => handleSetup(step)}
                  >
                    Set Up →
                  </Button>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-8 space-y-3 text-center">
            <p className="text-xs text-muted-foreground">
              You can complete these at any time from Settings.
            </p>
            <button
              type="button"
              onClick={handleLater}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground hover:underline"
            >
              I&apos;ll do this later
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export function setupDismissStorageKey(schoolId: number): string {
  return `${DISMISS_KEY_PREFIX}${schoolId}`;
}

export function isSetupDismissedForSession(schoolId: number): boolean {
  try {
    return sessionStorage.getItem(setupDismissStorageKey(schoolId)) === '1';
  } catch {
    return false;
  }
}

export function dismissSetupForSession(schoolId: number): void {
  try {
    sessionStorage.setItem(setupDismissStorageKey(schoolId), '1');
  } catch {
    // ignore
  }
}

export default SetupProgressModal;
