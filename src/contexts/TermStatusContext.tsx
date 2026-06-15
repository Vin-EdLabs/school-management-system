import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { useAuth } from './AuthContext';
import { useActiveTerm } from './ActiveTermContext';

export type LedgerTermStatus = {
  id: number;
  name: string;
  isCurrent: boolean;
  status: 'active' | 'closing' | 'closed' | string;
  academicYearName: string;
  label: string;
  closedAt?: string | null;
};

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
  effectiveViewingLabel: string;
  readOnly: boolean;
  readOnlyReason: string | null;
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
  effectiveViewingLabel: '',
  readOnly: false,
  readOnlyReason: null,
});

export const TermStatusProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { currentTerm } = useActiveTerm();
  const [ledgerTerms, setLedgerTerms] = useState<LedgerTermStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [viewingTermLabel, setViewingTermLabel] = useState<string | null>(null);

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

  // Reset viewing context when active term changes (e.g. after close + switch)
  useEffect(() => {
    setViewingTermLabel(null);
  }, [currentTerm]);

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

  const effectiveViewingLabel = viewingTermLabel ?? currentTerm ?? '';

  const viewingLedger = useMemo(
    () => findLedgerByLabel(effectiveViewingLabel, ledgerTerms),
    [effectiveViewingLabel, ledgerTerms]
  );

  const { readOnly, readOnlyReason } = useMemo(() => {
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
        readOnlyReason: `${viewingLedger.label} is closed — the system is read-only for this term. Switch to the current term to make changes.`,
      };
    }
    if (viewingLedger?.status === 'closing') {
      return { readOnly: true, readOnlyReason: `${viewingLedger.label} is being closed. Please wait.` };
    }
    return { readOnly: false, readOnlyReason: null };
  }, [isCurrentTermWritable, currentLedger, viewingLedger]);

  return (
    <TermStatusContext.Provider
      value={{
        ledgerTerms,
        isLoading,
        refresh,
        isTermClosed,
        isTermClosedByLabel,
        isCurrentTermWritable,
        closedTermLabels,
        viewingTermLabel,
        setViewingTermLabel,
        effectiveViewingLabel,
        readOnly,
        readOnlyReason,
      }}
    >
      {children}
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
