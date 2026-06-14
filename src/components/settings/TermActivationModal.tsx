import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSchool } from '../../contexts/SchoolContext';

type StepStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

type ActivationStep = {
  key: string;
  label: string;
  status: StepStatus;
  message?: string;
};

type TermActivationModalProps = {
  open: boolean;
  termName: string;
  academicYear: string;
  onActivate: () => Promise<void>;
  onClose: () => void;
  onSuccess: () => void;
};

const STEP_DEFS = [
  { key: 'switch', label: 'Switching term and carrying forward balances' },
  { key: 'settings', label: 'Updating school term settings' },
  { key: 'complete', label: 'Term activation complete' },
] as const;

const TermActivationModal: React.FC<TermActivationModalProps> = ({
  open,
  termName,
  academicYear,
  onActivate,
  onClose,
  onSuccess,
}) => {
  const { school } = useSchool();
  const [steps, setSteps] = useState<ActivationStep[]>([]);
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
            ? `Done — ${termName} ${academicYear} is now active`
            : s.label,
        status: 'pending' as StepStatus,
      }))
    );
  }, [termName, academicYear]);

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
    }, 700);
  }, [clearProgressTimer]);

  const runActivation = useCallback(async () => {
    resetSteps();
    setPhase('running');
    setErrorMessage(null);
    startProgressAnimation();

    try {
      await onActivate();
      clearProgressTimer();
      setSteps(
        STEP_DEFS.map((s, i) => ({
          ...s,
          label:
            i === STEP_DEFS.length - 1
              ? `Done — ${termName} ${academicYear} is now active`
              : s.label,
          status: 'success' as StepStatus,
        }))
      );
      setPhase('success');
    } catch (err: any) {
      clearProgressTimer();
      setPhase('failed');
      setErrorMessage(err?.message || 'Term activation failed');
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'running' || s.status === 'pending'
            ? { ...s, status: s.status === 'running' ? 'failed' : s.status, message: err?.message }
            : s
        )
      );
    }
  }, [resetSteps, startProgressAnimation, clearProgressTimer, onActivate, termName, academicYear]);

  useEffect(() => {
    if (open) {
      void runActivation();
    } else {
      clearProgressTimer();
      setPhase('idle');
      setErrorMessage(null);
      resetSteps();
    }
    return () => clearProgressTimer();
  }, [open, runActivation, resetSteps, clearProgressTimer]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (phase !== 'success') return;
    const timer = setTimeout(() => {
      onSuccess();
    }, 1200);
    return () => clearTimeout(timer);
  }, [phase, onSuccess]);

  if (!open) return null;

  const schoolLabel = school?.name || 'Your school';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-activation-title"
    >
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl">
        <div className="border-b px-6 py-5">
          <h2 id="term-activation-title" className="text-lg font-semibold text-foreground">
            Activating Academic Term
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while SCHOLARNERVE updates all records for {termName} {academicYear}
          </p>
          <p className="mt-2 text-xs font-medium text-slate-500">{schoolLabel}</p>
        </div>

        <div className="px-6 py-5 space-y-3 max-h-[50vh] overflow-y-auto">
          {steps.map((step) => (
            <div key={step.key} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {step.status === 'running' && (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden />
                )}
                {(step.status === 'success' || step.status === 'skipped') && (
                  <CheckCircle2
                    className={`h-5 w-5 ${step.status === 'skipped' ? 'text-slate-400' : 'text-emerald-600'}`}
                    aria-hidden
                  />
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
              <Button variant="primaryAction" onClick={() => void runActivation()}>
                Retry
              </Button>
            </>
          ) : phase === 'success' ? (
            <p className="text-sm text-emerald-700 mr-auto self-center">
              Term activated — starting arrears sync…
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mr-auto self-center">
              Do not close this window…
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default TermActivationModal;
