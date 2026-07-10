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
  { key: 'switch', label: 'Resolving ledger term and carrying forward balances' },
  { key: 'settings', label: 'Updating school term settings' },
  { key: 'complete', label: 'Finishing activation' },
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

  const resetSteps = useCallback(() => {
    setSteps(
      STEP_DEFS.map((s) => ({
        ...s,
        status: 'pending' as StepStatus,
      }))
    );
  }, []);

  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;
  const activationGenerationRef = useRef(0);

  const runActivation = useCallback(async () => {
    const gen = ++activationGenerationRef.current;
    resetSteps();
    setPhase('running');
    setErrorMessage(null);
    setSteps(
      STEP_DEFS.map((s, i) => ({
        ...s,
        status: i === 0 ? ('running' as StepStatus) : ('pending' as StepStatus),
      }))
    );

    try {
      await onActivateRef.current();
      if (gen !== activationGenerationRef.current) return;
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
      if (gen !== activationGenerationRef.current) return;
      const message = err?.message || 'Term activation failed';
      setPhase('failed');
      setErrorMessage(message);
      setSteps((prev) => {
        let failedMarked = false;
        return prev.map((s, i) => {
          if (s.status === 'success' || s.status === 'skipped') return s;
          if (!failedMarked) {
            failedMarked = true;
            return {
              ...s,
              status: 'failed' as StepStatus,
              message: i === 0 ? message : undefined,
            };
          }
          return {
            ...s,
            label: i === STEP_DEFS.length - 1 ? 'Activation was not completed' : s.label,
            status: 'skipped' as StepStatus,
          };
        });
      });
    }
  }, [resetSteps, termName, academicYear]);

  useEffect(() => {
    if (open) {
      void runActivation();
    } else {
      activationGenerationRef.current += 1;
      setPhase('idle');
      setErrorMessage(null);
      resetSteps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per open; onActivate via ref
  }, [open]);

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
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="term-activation-title"
    >
      <div className="flex min-h-full w-full justify-center">
        <div className="my-auto mx-auto w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-background shadow-2xl">
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
                  {step.status === 'success' && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-hidden />
                  )}
                  {step.status === 'skipped' && (
                    <div className="h-5 w-5 rounded-full border-2 border-slate-300 dark:border-slate-600" aria-hidden />
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
                          : step.status === 'skipped'
                            ? 'text-slate-400'
                            : 'text-foreground'
                    }`}
                  >
                    {step.label}
                  </p>
                  {step.message ? (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{step.message}</p>
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
                Term activated — continuing…
              </p>
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

export default TermActivationModal;
