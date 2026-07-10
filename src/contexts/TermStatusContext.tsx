import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { ActiveTermContext, useActiveTerm } from './ActiveTermContext';
import {
  getClosedTermBrowse,
  setClosedTermBrowse,
} from '../utils/closedTermBrowse';
import { setActiveTermCache } from '../utils/feeCalculations';

export type LedgerTermStatus = {
  id: number;
  name: string;
  isCurrent: boolean;
  status: 'active' | 'closing' | 'closed' | string;
  academicYearName: string;
  label: string;
  closedAt?: string | null;
};

type BrowseMode = 'closed-term' | 'reports' | null;

function normalizeTermLabel(label: string): string {
  return String(label || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function findLedgerByLabel(label: string, ledgerTerms: LedgerTermStatus[]): LedgerTermStatus | null {
  const norm = normalizeTermLabel(label);
  if (!norm) return null;
  return (
    ledgerTerms.find((t) => {
      const full = normalizeTermLabel(t.label);
      const nameOnly = normalizeTermLabel(t.name);
      const withYear = normalizeTermLabel(`${t.name} ${t.academicYearName}`);
      return full === norm || nameOnly === norm || withYear === norm || full.includes(norm) || norm.includes(full);
    }) ?? null
  );
}

type TermStatusContextType = {
  ledgerTerms: LedgerTermStatus[];
  isLoading: boolean;
  refresh: () => Promise<void>;
  isTermClosed: (termId: number | null | undefined) => boolean;
  isTermClosedByLabel: (label: string | null | undefined) => boolean;
  isCurrentTermWritable: boolean;
  closedTermLabels: string[];
  /** When set, app operates in this term's context (e.g. reports tab). Null = active term. */
  viewingTermLabel: string | null;
  setViewingTermLabel: (label: string | null) => void;
  /** Enter read-only browse of a closed/old term across all pages. */
  enterClosedTermBrowse: (label: string, ledgerTermId?: number | null) => void;
  /** Exit browse mode and return to the live active term. */
  exitClosedTermBrowse: () => void;
  isBrowsingClosedTerm: boolean;
  viewingLedgerTermId: number | null;
  effectiveViewingLabel: string;
  readOnly: boolean;
  readOnlyReason: string | null;
  browseMode: BrowseMode;
};

const TermStatusContext = createContext<TermStatusContextType>({
  ledgerTerms: [],
  isLoading: false,
  refresh: async () => {},
  isTermClosed: () => false,
  isTermClosedByLabel: () => false,
  isCurrentTermWritable: true,
  closedTermLabels: [],
  viewingTermLabel: null,
  setViewingTermLabel: () => {},
  enterClosedTermBrowse: () => {},
  exitClosedTermBrowse: () => {},
  isBrowsingClosedTerm: false,
  viewingLedgerTermId: null,
  effectiveViewingLabel: '',
  readOnly: false,
  readOnlyReason: null,
  browseMode: null,
});

export const TermStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const liveActiveTerm = useActiveTerm();
  const { currentTerm } = liveActiveTerm;
  const [ledgerTerms, setLedgerTerms] = useState<LedgerTermStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const initialBrowse = getClosedTermBrowse();
  const [viewingTermLabel, setViewingTermLabelState] = useState<string | null>(
    () => initialBrowse?.label ?? null
  );
  const [browseMode, setBrowseMode] = useState<BrowseMode>(() =>
    initialBrowse?.label ? 'closed-term' : null
  );
  const [viewingLedgerTermIdOverride, setViewingLedgerTermIdOverride] = useState<number | null>(
    () => initialBrowse?.ledgerTermId ?? null
  );

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const rows = await apiService.get<any[]>('/finance/terms').catch(() => []);
      const list = Array.isArray(rows) ? rows : [];
      setLedgerTerms(
        list.map((t) => {
          const label = `${t.name || ''} ${t.academic_year_name || ''}`.trim();
          return {
            id: Number(t.id),
            name: String(t.name || ''),
            isCurrent: !!t.is_current,
            status: String(t.status || 'active'),
            academicYearName: String(t.academic_year_name || ''),
            label,
            closedAt: t.closed_at ?? null,
          };
        })
      );
    } catch {
      setLedgerTerms([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void refresh();
  }, [isAuthenticated, refresh, currentTerm]);

  // Reset report viewing when active term changes; keep intentional closed-term browse
  useEffect(() => {
    if (browseMode === 'reports') {
      setViewingTermLabelState(null);
      setBrowseMode(null);
      setViewingLedgerTermIdOverride(null);
    }
  }, [currentTerm]); // eslint-disable-line react-hooks/exhaustive-deps

  const setViewingTermLabel = useCallback((label: string | null) => {
    setBrowseMode((prev) => {
      // Never let reports tab overwrite / clear an intentional closed-term browse
      if (prev === 'closed-term') return prev;
      if (label) {
        setViewingTermLabelState(label);
        return 'reports';
      }
      setViewingTermLabelState(null);
      setViewingLedgerTermIdOverride(null);
      return null;
    });
  }, []);

  const enterClosedTermBrowse = useCallback(
    (label: string, ledgerTermId?: number | null) => {
      const clean = String(label || '').trim();
      if (!clean) return;
      let id =
        ledgerTermId != null && !Number.isNaN(Number(ledgerTermId)) ? Number(ledgerTermId) : null;
      if (id == null) {
        id = findLedgerByLabel(clean, ledgerTerms)?.id ?? null;
      }
      setViewingTermLabelState(clean);
      setBrowseMode('closed-term');
      setViewingLedgerTermIdOverride(id);
      setClosedTermBrowse({ label: clean, ledgerTermId: id });
    },
    [ledgerTerms]
  );

  const exitClosedTermBrowse = useCallback(() => {
    setViewingTermLabelState(null);
    setBrowseMode(null);
    setViewingLedgerTermIdOverride(null);
    setClosedTermBrowse(null);
  }, []);

  const isTermClosed = useCallback(
    (termId: number | null | undefined) => {
      if (termId == null) return false;
      const t = ledgerTerms.find((row) => row.id === termId);
      return t?.status === 'closed';
    },
    [ledgerTerms]
  );

  const isTermClosedByLabel = useCallback(
    (label: string | null | undefined) => {
      if (!label) return false;
      const t = findLedgerByLabel(label, ledgerTerms);
      return t?.status === 'closed';
    },
    [ledgerTerms]
  );

  const currentLedger = useMemo(
    () => ledgerTerms.find((t) => t.isCurrent) ?? null,
    [ledgerTerms]
  );

  const isCurrentTermWritable = currentLedger
    ? currentLedger.status !== 'closed' && currentLedger.status !== 'closing'
    : true;

  const closedTermLabels = useMemo(
    () => ledgerTerms.filter((t) => t.status === 'closed').map((t) => t.label),
    [ledgerTerms]
  );

  const isBrowsingClosedTerm = browseMode === 'closed-term' && !!viewingTermLabel;
  const effectiveViewingLabel = viewingTermLabel ?? currentTerm ?? '';

  // After ledger terms load, fill in missing browse ledgerTermId from the label.
  useEffect(() => {
    if (!isBrowsingClosedTerm || !viewingTermLabel || viewingLedgerTermIdOverride != null) return;
    if (ledgerTerms.length === 0) return;
    const found = findLedgerByLabel(viewingTermLabel, ledgerTerms);
    if (found?.id != null) {
      setViewingLedgerTermIdOverride(found.id);
      setClosedTermBrowse({ label: viewingTermLabel, ledgerTermId: found.id });
    }
  }, [isBrowsingClosedTerm, viewingTermLabel, viewingLedgerTermIdOverride, ledgerTerms]);

  const viewingLedger = useMemo(
    () => findLedgerByLabel(effectiveViewingLabel, ledgerTerms),
    [effectiveViewingLabel, ledgerTerms]
  );

  const viewingLedgerTermId =
    viewingLedgerTermIdOverride ??
    (isBrowsingClosedTerm || browseMode === 'reports' ? viewingLedger?.id ?? null : null);

  const { readOnly, readOnlyReason } = useMemo(() => {
    if (isBrowsingClosedTerm) {
      return {
        readOnly: true,
        readOnlyReason: `You are browsing ${viewingTermLabel} (read-only snapshot). Exit to return to the current term.`,
      };
    }
    if (!isCurrentTermWritable) {
      if (currentLedger?.status === 'closing') {
        return { readOnly: true, readOnlyReason: 'A term close is in progress. Please wait.' };
      }
      return {
        readOnly: true,
        readOnlyReason: `${currentLedger?.label ?? 'Active term'} is closed. Switch to an open term in Settings.`,
      };
    }
    if (viewingLedger?.status === 'closed') {
      return {
        readOnly: true,
        readOnlyReason: `${viewingLedger.label} is closed — the system is read-only for this term. Exit to the current term to make changes.`,
      };
    }
    if (viewingLedger?.status === 'closing') {
      return { readOnly: true, readOnlyReason: `${viewingLedger.label} is being closed. Please wait.` };
    }
    return { readOnly: false, readOnlyReason: null };
  }, [
    isBrowsingClosedTerm,
    viewingTermLabel,
    isCurrentTermWritable,
    currentLedger,
    viewingLedger,
  ]);

  const browseActiveTermValue = useMemo(() => {
    if (!isBrowsingClosedTerm || !viewingTermLabel) return liveActiveTerm;
    const ledger =
      (viewingLedgerTermId != null
        ? ledgerTerms.find((t) => t.id === viewingLedgerTermId)
        : null) ?? viewingLedger;
    const year =
      ledger?.academicYearName ||
      viewingTermLabel.match(/\b(20\d{2}(?:\/\d{2,4})?)\b/)?.[1] ||
      liveActiveTerm.currentYear;
    return {
      ...liveActiveTerm,
      currentTerm: viewingTermLabel,
      currentYear: year,
      activeLedgerTermId: viewingLedgerTermId ?? ledger?.id ?? null,
      // Keep live academic term id so Settings still knows the real active term.
      hasActiveTerm: true,
    };
  }, [
    isBrowsingClosedTerm,
    viewingTermLabel,
    viewingLedgerTermId,
    viewingLedger,
    ledgerTerms,
    liveActiveTerm,
  ]);

  // Keep legacy getActiveAcademicTerm() cache in sync for finance dashboards/reports.
  useEffect(() => {
    if (isBrowsingClosedTerm && browseActiveTermValue.currentTerm) {
      setActiveTermCache(browseActiveTermValue.currentTerm, browseActiveTermValue.currentYear);
    } else if (liveActiveTerm.currentTerm) {
      setActiveTermCache(liveActiveTerm.currentTerm, liveActiveTerm.currentYear);
    }
  }, [
    isBrowsingClosedTerm,
    browseActiveTermValue.currentTerm,
    browseActiveTermValue.currentYear,
    liveActiveTerm.currentTerm,
    liveActiveTerm.currentYear,
  ]);

  const statusValue = useMemo(
    () => ({
      ledgerTerms,
      isLoading,
      refresh,
      isTermClosed,
      isTermClosedByLabel,
      isCurrentTermWritable,
      closedTermLabels,
      viewingTermLabel,
      setViewingTermLabel,
      enterClosedTermBrowse,
      exitClosedTermBrowse,
      isBrowsingClosedTerm,
      viewingLedgerTermId,
      effectiveViewingLabel,
      readOnly,
      readOnlyReason,
      browseMode,
    }),
    [
      ledgerTerms,
      isLoading,
      refresh,
      isTermClosed,
      isTermClosedByLabel,
      isCurrentTermWritable,
      closedTermLabels,
      viewingTermLabel,
      setViewingTermLabel,
      enterClosedTermBrowse,
      exitClosedTermBrowse,
      isBrowsingClosedTerm,
      viewingLedgerTermId,
      effectiveViewingLabel,
      readOnly,
      readOnlyReason,
      browseMode,
    ]
  );

  return (
    <TermStatusContext.Provider value={statusValue}>
      <ActiveTermContext.Provider value={browseActiveTermValue}>
        {children}
      </ActiveTermContext.Provider>
    </TermStatusContext.Provider>
  );
};

export const useTermStatus = () => useContext(TermStatusContext);

/** System-wide read-only when viewing or operating in a closed term. */
export function useTermReadOnly(): {
  readOnly: boolean;
  reason: string | null;
  currentTermLabel: string | null;
  viewingTermLabel: string | null;
} {
  const { readOnly, readOnlyReason, effectiveViewingLabel, viewingTermLabel, ledgerTerms } =
    useTermStatus();
  const viewingLedger = findLedgerByLabel(effectiveViewingLabel, ledgerTerms);
  return {
    readOnly,
    reason: readOnlyReason,
    currentTermLabel: viewingLedger?.label ?? (effectiveViewingLabel || null),
    viewingTermLabel,
  };
}

/** Active term, or the closed term being browsed (for data filters). */
export function useEffectiveLedgerTerm(): {
  termLabel: string;
  ledgerTermId: number | null;
  isBrowsingClosedTerm: boolean;
} {
  const { currentTerm, activeLedgerTermId } = useActiveTerm();
  const { isBrowsingClosedTerm, viewingTermLabel, viewingLedgerTermId, effectiveViewingLabel } =
    useTermStatus();

  if (isBrowsingClosedTerm) {
    return {
      termLabel: viewingTermLabel || effectiveViewingLabel || currentTerm,
      ledgerTermId: viewingLedgerTermId,
      isBrowsingClosedTerm: true,
    };
  }
  return {
    termLabel: currentTerm,
    ledgerTermId: activeLedgerTermId,
    isBrowsingClosedTerm: false,
  };
}
