import React from 'react';
import { Lock, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTermReadOnly, useTermStatus } from '../../contexts/TermStatusContext';

export function ClosedTermBanner({ inSettings = false }: { inSettings?: boolean }) {
  const { readOnly, reason, currentTermLabel } = useTermReadOnly();
  const {
    viewingTermLabel,
    isBrowsingClosedTerm,
    exitClosedTermBrowse,
    setViewingTermLabel,
    ledgerTerms,
  } = useTermStatus();

  // Global ClosedTermViewBar covers browse mode; avoid duplicate banners.
  if (isBrowsingClosedTerm) return null;
  if (!readOnly || !reason) return null;

  const currentOpen = ledgerTerms.find((t) => t.isCurrent && t.status === 'active');

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm flex-1 min-w-0">
          <p className="font-semibold break-words">
            {isBrowsingClosedTerm
              ? `Browsing ${viewingTermLabel} (read-only)`
              : currentTermLabel
                ? `${currentTermLabel} is closed`
                : 'Read-only term'}
          </p>
          <p className="mt-0.5 text-amber-800 dark:text-amber-200">
            {isBrowsingClosedTerm
              ? inSettings
                ? 'You are viewing a past term snapshot. Use the sidebar to open Fees, Students, Reports, and more. Click Exit to return to the current term.'
                : `${reason} Search, view receipts, and run reports are available. Editing is disabled.`
              : inSettings
                ? 'Other modules are read-only while you view this closed term. Settings stays open so you can manage terms.'
                : `${reason} You can still search, view receipts, run reports, and download PDFs.`}
          </p>
        </div>
      </div>
      {(isBrowsingClosedTerm || viewingTermLabel) && currentOpen ? (
        <Button
          type="button"
          size="sm"
          className="readonly-allowed self-start h-8 bg-amber-700 hover:bg-amber-800 text-white dark:bg-amber-600"
          onClick={() => {
            if (isBrowsingClosedTerm) exitClosedTermBrowse();
            else setViewingTermLabel(null);
          }}
        >
          <LogOut className="mr-1.5 h-3.5 w-3.5" />
          Exit to current term ({currentOpen.label})
        </Button>
      ) : null}
    </div>
  );
}

export default ClosedTermBanner;
