import React from 'react';
import { Lock, LogOut, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTermStatus } from '../../contexts/TermStatusContext';

type Props = {
  setActiveModule?: (module: string) => void;
};

export function ClosedTermViewBar({ setActiveModule }: Props) {
  const { viewingTermLabel, isBrowsingClosedTerm, exitClosedTermBrowse, ledgerTerms } = useTermStatus();

  if (!isBrowsingClosedTerm || !viewingTermLabel) return null;

  const currentOpen = ledgerTerms.find((t) => t.isCurrent && t.status === 'active');

  return (
    <div className="readonly-allowed sticky top-0 z-40 mx-3 mt-2 shrink-0 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-950 shadow-md dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-100 print:hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold break-words">
              Viewing {viewingTermLabel} <span className="font-normal">(read-only snapshot)</span>
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Use the sidebar to open Fees, Students, Reports, and more. Edits stay disabled until you exit.
              {currentOpen ? ` Live term: ${currentOpen.label}.` : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {setActiveModule ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-amber-300 bg-white/80 dark:border-amber-700 dark:bg-amber-950/40"
              onClick={() => setActiveModule('settings')}
            >
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Settings
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-8 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-600 dark:hover:bg-amber-500"
            onClick={() => exitClosedTermBrowse()}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5" />
            Exit to current term
          </Button>
        </div>
      </div>
    </div>
  );
}

export default ClosedTermViewBar;
