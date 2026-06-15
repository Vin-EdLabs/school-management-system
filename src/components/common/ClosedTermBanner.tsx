import React from 'react';
import { Lock } from 'lucide-react';
import { useTermReadOnly, useTermStatus } from '../../contexts/TermStatusContext';

export function ClosedTermBanner({ inSettings = false }: { inSettings?: boolean }) {
  const { readOnly, reason, currentTermLabel } = useTermReadOnly();
  const { viewingTermLabel, setViewingTermLabel, ledgerTerms } = useTermStatus();

  if (!readOnly || !reason) return null;

  const currentOpen = ledgerTerms.find((t) => t.isCurrent && t.status === 'active');

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm flex-1">
          <p className="font-semibold">
            {currentTermLabel ? `🔒 ${currentTermLabel} is closed` : '🔒 Read-only term'}
          </p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-200">
            {inSettings
              ? 'Other modules are read-only while you view this closed term. Settings stays open — you can add terms, activate the next term, or close the current term here.'
              : `${reason} You can still search, view receipts, run reports, and download PDFs. Adding or editing students, teachers, fees, and other records is disabled. Open Settings to add or switch terms.`}
          </p>
        </div>
      </div>
      {!inSettings && viewingTermLabel && currentOpen ? (
        <button
          type="button"
          className="readonly-allowed self-start text-xs font-semibold text-amber-900 underline dark:text-amber-200"
          onClick={() => setViewingTermLabel(null)}
        >
          Switch to current term ({currentOpen.label}) to edit
        </button>
      ) : null}
    </div>
  );
}

export default ClosedTermBanner;
