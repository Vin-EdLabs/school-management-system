import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';

type StepStatus = 'pending' | 'running' | 'success' | 'failed';

type SyncStep = {
  key: string;
  label: string;
  status: StepStatus;
  message?: string;
};

type ArrearsSyncModalProps = {
  open: boolean;
  termLabel?: string;
  onClose: () => void;
  onComplete: () => void;
};

const STEP_DEFS = [
  { key: 'backfill', label: 'Carrying forward unpaid balances from previous term' },
  { key: 'sync', label: 'Syncing arrears across all classes' },
  { key: 'refresh', label: 'Refreshing student fee records' },
  { key: 'complete', label: 'Arrears sync complete' },
] as const;

const ArrearsSyncModal: React.FC<ArrearsSyncModalProps> = ({
  open,
  termLabel,
  onClose,
  onComplete,
}) => {
  const { school } = useSchool();
  const [steps, setSteps] = useState<SyncStep[]>([]);
  const [phase, setPhase] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const resetSteps = useCallback(() => {
    setSteps(
      STEP_DEFS.map((s, i) => ({
        ...s,
        label:
          i === STEP_DEFS.length - 1
            ? termLabel
              ? `Done — arrears updated for ${termLabel}`
              : 'Done — arrears updated'
            : s.label,
        status: 'pending' as StepStatus,
      }))
    );
  }, [termLabel]);

  const setStepStatus = useCallback((key: string, status: StepStatus, message?: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status, message } : s))
    );
  }, []);

  const startProgressAnimation = useCallback(() => {
    clearProgressTimer();
    let runningIndex = 0;
    setSteps((prev) =>
      prev.map((s, i) => ({
        ...s,
        status: i === 0 ? 'running' : 'pending',
      }))
    );
    progressTimerRef.current = setInterval(() => {
      runningIndex = Math.min(runningIndex + 1, STEP_DEFS.length - 2);
      setSteps((prev) =>
        prev.map((s, i) => {
          if (i < runningIndex) return { ...s, status: 'success' };
          if (i === runningIndex) return { ...s, status: 'running' };
          return { ...s, status: 'pending' };
        })
      );
    }, 650);
  }, [clearProgressTimer]);

  const runSync = useCallback(async () => {
    resetSteps();
    setPhase('running');
    setErrorMessage(null);
    startProgressAnimation();

    try {
      setStepStatus('backfill', 'running');
      const backfill = await apiService.post<{
        message?: string;
        arrearsRowsInserted?: number;
        studentsProcessed?: number;
      }>('/finance/backfill-arrears', {});

      clearProgressTimer();
      setStepStatus(
        'backfill',
        'success',
        backfill.message ||
          (backfill.arrearsRowsInserted
            ? `${backfill.arrearsRowsInserted} arrears row(s) backfilled`
            : undefined)
      );

      setStepStatus('sync', 'running');
      const sync = await apiService.post<{
        message?: string;
        studentsUpdated?: number;
        currentTerm?: string;
        carryForward?: { arrearsRowsInserted?: number };
      }>('/settings/sync-arrears', {});

      const syncCount =
        sync.studentsUpdated ??
        sync.carryForward?.arrearsRowsInserted ??
        backfill.arrearsRowsInserted ??
        0;
      setStepStatus(
        'sync',
        'success',
        sync.currentTerm
          ? `Updated for ${sync.currentTerm}${syncCount ? ` (${syncCount} student${syncCount === 1 ? '' : 's'})` : ''}`
          : sync.message
      );

      setStepStatus('refresh', 'running');
      await new Promise((r) => setTimeout(r, 400));
      setStepStatus('refresh', 'success');
      setStepStatus('complete', 'success');
      setPhase('success');
    } catch (err: any) {
      clearProgressTimer();
      setPhase('failed');
      setErrorMessage(err?.message || 'Arrears sync failed');
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' || s.status === 'pending'
            ? { ...s, status: s.status === 'running' ? 'failed' : s.status, message: err?.message }
            : s
        )
      );
    }
  }, [resetSteps, startProgressAnimation, clearProgressTimer, setStepStatus]);

  useEffect(() => {
    if (open) {
      void runSync();
    } else {
      clearProgressTimer();
      setPhase('idle');
      setErrorMessage(null);
      resetSteps();
    }
    return () => clearProgressTimer();
  }, [open, runSync, resetSteps, clearProgressTimer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!open) return null;

  const schoolLabel = school?.name || 'Your school';

  return (
    <div
      className="fixed inset-0 z-[110] overflow-y-auto bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="arrears-sync-title"
    >
      <div className="flex min-h-full w-full justify-center">
        <div className="my-auto mx-auto w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
        <div className="border-b px-6 py-5">
          <h2 id="arrears-sync-title" className="text-lg font-semibold text-foreground">
            Syncing Arrears
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while SCHOLARNERVE carries forward unpaid balances
            {termLabel ? ` for ${termLabel}` : ''}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">{schoolLabel}</p>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {steps.map((step) => (
            <div key={step.key} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {step.status === 'running' && (
                  <Loader2 className="h-5 w-5 animate-spin text-amber-600" aria-hidden />
                )}
                {step.status === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                )}
                {step.status === 'failed' && <XCircle className="h-5 w-5 text-red-600" aria-hidden />}
                {step.status === 'pending' && (
                  <div className="h-5 w-5 rounded-full border-2 border-muted" aria-hidden />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.status === 'failed'
                      ? 'text-red-700'
                      : step.status === 'success'
                        ? 'text-emerald-800'
                        : 'text-foreground'
                  }`}
                >
                  {step.label}
                </p>
                {step.message ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{step.message}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t px-6 py-4 flex flex-wrap justify-end gap-2">
          {phase === 'failed' ? (
            <>
              <p className="text-sm text-red-600 mr-auto self-center">{errorMessage}</p>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primaryAction" onClick={() => void runSync()}>
                Retry
              </Button>
            </>
          ) : phase === 'success' ? (
            <Button
              variant="primaryAction"
              onClick={() => {
                onComplete();
                onClose();
              }}
            >
              Close
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground mr-auto self-center">
              Do not close this window…
            </p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

export default ArrearsSyncModal;
