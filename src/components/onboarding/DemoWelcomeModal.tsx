import React, { useCallback, useId } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Beaker, GraduationCap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ModalViewport } from '@/components/ui/dialog';
import { resolveLogoUrl } from '@/services/tenantService';
import { useSchool } from '@/contexts/SchoolContext';

const DISMISS_KEY_PREFIX = 'scholarnerve_demo_welcome_';

export type DemoWelcomeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  schoolName: string;
  onDismissForSession: () => void;
};

const DemoWelcomeModal: React.FC<DemoWelcomeModalProps> = ({
  open,
  onOpenChange,
  userName,
  schoolName,
  onDismissForSession,
}) => {
  const { school } = useSchool();
  const titleId = useId();
  const descId = useId();
  const logoUrl = resolveLogoUrl(school?.logo_url ?? null);
  const greetingName = userName.trim() || 'there';

  const handleContinue = useCallback(() => {
    onDismissForSession();
    onOpenChange(false);
  }, [onDismissForSession, onOpenChange]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[200] bg-slate-900/45 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <ModalViewport className="z-[201]">
          <DialogPrimitive.Content
            aria-labelledby={titleId}
            aria-describedby={descId}
            className={cn(
              'pointer-events-auto relative my-auto mx-auto w-[min(calc(100vw-2rem),26rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto',
              'rounded-2xl border border-violet-200/80 bg-gradient-to-b from-white to-violet-50/90 p-0 shadow-2xl shadow-violet-900/15',
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
              'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 dark:from-slate-900 dark:to-violet-950/50 dark:border-violet-800/50'
            )}
          >
            <div className="relative overflow-hidden rounded-2xl">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-violet-400/25 blur-2xl" />
              <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-sky-400/20 blur-2xl" />

              <div className="border-b border-violet-100/80 px-6 pb-5 pt-6 dark:border-violet-900/40">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/30">
                    {logoUrl ? (
                      <img src={logoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <GraduationCap className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                      Demo mode
                    </p>
                    <h2 id={titleId} className="truncate text-lg font-bold text-slate-900 dark:text-white">
                      Welcome, {greetingName}
                    </h2>
                  </div>
                  <Beaker className="h-5 w-5 shrink-0 text-violet-500" aria-hidden />
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                <p id={descId} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  You&apos;re exploring{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{schoolName}</span> with{' '}
                  <span className="font-semibold text-violet-800 dark:text-violet-200">sample data</span> — students,
                  fees, grades, timetables, and reports are here so you can try the system safely.
                </p>

                <div className="flex items-start gap-3 rounded-xl border border-violet-100 bg-white/90 px-4 py-3 dark:border-violet-900/40 dark:bg-slate-900/50">
                  <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Click around freely. Changes stay in this demo school and won&apos;t affect real records.
                  </p>
                </div>
              </div>

              <div className="border-t border-violet-100/80 px-6 py-4 dark:border-violet-900/40">
                <Button
                  type="button"
                  className="readonly-allowed w-full bg-violet-600 hover:bg-violet-700"
                  onClick={handleContinue}
                >
                  Got it — let&apos;s explore
                </Button>
              </div>
            </div>
          </DialogPrimitive.Content>
        </ModalViewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export function isDemoWelcomeDismissed(schoolId: number): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_KEY_PREFIX}${schoolId}`) === '1';
  } catch {
    return false;
  }
}

export function dismissDemoWelcomeForSession(schoolId: number): void {
  try {
    sessionStorage.setItem(`${DISMISS_KEY_PREFIX}${schoolId}`, '1');
  } catch {
    /* ignore */
  }
}

export function clearDemoWelcomeDismiss(schoolId: number): void {
  try {
    sessionStorage.removeItem(`${DISMISS_KEY_PREFIX}${schoolId}`);
  } catch {
    /* ignore */
  }
}

export default DemoWelcomeModal;
