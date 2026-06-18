import React, { useCallback, useId } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CalendarClock, GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModalViewport } from '@/components/ui/dialog';
import { resolveLogoUrl } from '@/services/tenantService';
import { useSchool } from '@/contexts/SchoolContext';

const DISMISS_KEY_PREFIX = 'scholarnerve_active_term_welcome_';

export type ActiveTermWelcomeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  schoolName: string;
  onGoToSettings: () => void;
  onDismissForSession: () => void;
};

const ActiveTermWelcomeModal: React.FC<ActiveTermWelcomeModalProps> = ({
  open,
  onOpenChange,
  userName,
  schoolName,
  onGoToSettings,
  onDismissForSession,
}) => {
  const { school } = useSchool();
  const titleId = useId();
  const descId = useId();
  const logoUrl = resolveLogoUrl(school?.logo_url ?? null);
  const greetingName = userName.trim() || 'there';

  const handleLater = useCallback(() => {
    onDismissForSession();
    onOpenChange(false);
  }, [onDismissForSession, onOpenChange]);

  const handleSetup = useCallback(() => {
    onGoToSettings();
    onOpenChange(false);
  }, [onGoToSettings, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-black/55 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <ModalViewport className="z-[201]">
          <DialogPrimitive.Content
            aria-labelledby={titleId}
            aria-describedby={descId}
            className={cn(
              'pointer-events-auto relative my-auto mx-auto w-[min(calc(100vw-2rem),28rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto',
              'rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/80 p-0 shadow-2xl shadow-emerald-900/20',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:from-slate-900 dark:to-emerald-950/40 dark:border-emerald-800/60'
            )}
          >
          <div className="relative overflow-hidden rounded-2xl">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-sky-400/15 blur-2xl" />

            <div className="border-b border-emerald-100/80 px-6 pb-5 pt-6 dark:border-emerald-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <GraduationCap className="h-6 w-6" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Welcome to ScholarNerve
                  </p>
                  <h2 id={titleId} className="truncate text-lg font-bold text-slate-900 dark:text-white">
                    Hello, {greetingName}!
                  </h2>
                </div>
                <Sparkles className="ml-auto h-5 w-5 shrink-0 text-amber-500" />
              </div>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p id={descId} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                You are signed in to <span className="font-semibold text-slate-800 dark:text-slate-100">{schoolName}</span>.
                Before students, fees, income, expenses, and the rest of the system can be used, please{' '}
                <span className="font-semibold text-emerald-800 dark:text-emerald-200">set an active academic term</span> in
                Settings.
              </p>

              <div className="flex items-start gap-3 rounded-xl border border-emerald-100 bg-white/80 px-4 py-3 dark:border-emerald-900/50 dark:bg-slate-900/50">
                <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p className="font-medium text-slate-800 dark:text-slate-100">Quick setup</p>
                  <p className="mt-1">
                    Open <strong>Settings → Academic Terms</strong>, add your term if needed, then tap{' '}
                    <strong>Set Active</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-emerald-100/80 px-6 py-4 sm:flex-row sm:justify-end dark:border-emerald-900/50">
              <Button type="button" variant="ghost" className="readonly-allowed" onClick={handleLater}>
                I&apos;ll do this later
              </Button>
              <Button type="button" className="readonly-allowed bg-emerald-600 hover:bg-emerald-700" onClick={handleSetup}>
                Set active term now
              </Button>
            </div>
          </div>
          </DialogPrimitive.Content>
        </ModalViewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export function isActiveTermWelcomeDismissed(schoolId: number): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${schoolId}`) === '1';
  } catch {
    return false;
  }
}

export function dismissActiveTermWelcomeForSession(schoolId: number): void {
  try {
    sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${schoolId}`, '1');
  } catch {
    /* ignore */
  }
}

/** Call after login so the welcome modal can show again for a new session. */
export function clearActiveTermWelcomeDismiss(schoolId: number): void {
  try {
    sessionStorage.removeItem(`${DISMISS_KEY_PREFIX}${schoolId}`);
  } catch {
    /* ignore */
  }
}

export default ActiveTermWelcomeModal;
