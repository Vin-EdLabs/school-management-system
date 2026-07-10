import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { setActiveTermCache } from '../utils/feeCalculations';
import { useAuth } from './AuthContext';

interface ActiveTermContextType {
  currentTerm: string;
  currentYear: string;
  activeAcademicTermId: number | null;
  activeLedgerTermId: number | null;
  hasActiveTerm: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

type AcademicTermRow = {
  id: number;
  term_name: string;
  year: string;
  is_active: boolean;
  ledger_term_id?: number | null;
};

type LedgerTermRow = {
  id: number;
  name: string;
  is_current?: boolean;
  academic_year_name?: string;
};

const defaultTerm = 'Not Set';
const defaultYear = new Date().getFullYear().toString();

export const ActiveTermContext = createContext<ActiveTermContextType>({
  currentTerm: defaultTerm,
  currentYear: defaultYear,
  activeAcademicTermId: null,
  activeLedgerTermId: null,
  hasActiveTerm: false,
  isLoading: false,
  refresh: async () => {},
});

export const ActiveTermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [currentTerm, setCurrentTerm] = useState(defaultTerm);
  const [currentYear, setCurrentYear] = useState(defaultYear);
  const [activeAcademicTermId, setActiveAcademicTermId] = useState<number | null>(null);
  const [activeLedgerTermId, setActiveLedgerTermId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let term = defaultTerm;
      let year = defaultYear;
      let academicTermId: number | null = null;
      let ledgerTermId: number | null = null;

      const [settings, terms, ledgerTerms] = await Promise.all([
        apiService.get<{ current_term?: string; current_year?: string }>('/settings'),
        apiService.get<AcademicTermRow[]>('/settings/academic-terms').catch(() => []),
        apiService.get<LedgerTermRow[]>('/finance/terms').catch(() => []),
      ]);

      const activeAcademic = Array.isArray(terms) ? terms.find((t) => t.is_active) : null;
      const ledgerById = new Map(
        (Array.isArray(ledgerTerms) ? ledgerTerms : []).map((t) => [Number(t.id), t])
      );

      if (activeAcademic?.ledger_term_id != null) {
        ledgerTermId = Number(activeAcademic.ledger_term_id);
      } else {
        const currentLedger = Array.isArray(ledgerTerms)
          ? ledgerTerms.find((t) => t.is_current)
          : null;
        if (currentLedger?.id != null) {
          ledgerTermId = Number(currentLedger.id);
        }
      }

      const linkedLedger =
        ledgerTermId != null ? ledgerById.get(ledgerTermId) ?? null : null;

      if (linkedLedger) {
        const ledgerYear = String(linkedLedger.academic_year_name || '').trim();
        const ledgerName = String(linkedLedger.name).trim();
        term = ledgerYear ? `${ledgerName} ${ledgerYear}`.trim() : ledgerName;
        year = ledgerYear || activeAcademic?.year || settings?.current_year || defaultYear;
      } else if (activeAcademic) {
        term = `${activeAcademic.term_name} ${activeAcademic.year}`.trim();
        year = activeAcademic.year;
      } else if (settings?.current_term) {
        term = settings.current_term;
        year = settings?.current_year || defaultYear;
      }

      if (activeAcademic) {
        academicTermId = activeAcademic.id;
      }

      setCurrentTerm(term);
      setCurrentYear(year);
      setActiveAcademicTermId(academicTermId);
      setActiveLedgerTermId(ledgerTermId);
      setActiveTermCache(term, year);
    } catch {
      setCurrentTerm(defaultTerm);
      setCurrentYear(defaultYear);
      setActiveAcademicTermId(null);
      setActiveLedgerTermId(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [refresh, isAuthenticated]);

  const hasActiveTerm =
    activeLedgerTermId != null ||
    activeAcademicTermId != null ||
    (currentTerm !== defaultTerm && currentTerm.trim().length > 0);

  return (
    <ActiveTermContext.Provider
      value={{ currentTerm, currentYear, activeAcademicTermId, activeLedgerTermId, hasActiveTerm, isLoading, refresh }}
    >
      {children}
    </ActiveTermContext.Provider>
  );
};

export const useActiveTerm = () => useContext(ActiveTermContext);
