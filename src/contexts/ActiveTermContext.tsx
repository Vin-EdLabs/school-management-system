import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { setActiveTermCache } from '../utils/feeCalculations';
import { useAuth } from './AuthContext';

interface ActiveTermContextType {
  currentTerm: string;
  currentYear: string;
  activeAcademicTermId: number | null;
  hasActiveTerm: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultTerm = 'Not Set';
const defaultYear = new Date().getFullYear().toString();

const ActiveTermContext = createContext<ActiveTermContextType>({
  currentTerm: defaultTerm,
  currentYear: defaultYear,
  activeAcademicTermId: null,
  hasActiveTerm: false,
  isLoading: false,
  refresh: async () => {},
});

export const ActiveTermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [currentTerm, setCurrentTerm] = useState(defaultTerm);
  const [currentYear, setCurrentYear] = useState(defaultYear);
  const [activeAcademicTermId, setActiveAcademicTermId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let term = defaultTerm;
      let year = defaultYear;
      let academicTermId: number | null = null;

      const settings = await apiService.get<{ current_term?: string; current_year?: string }>('/settings');
      const terms = await apiService
        .get<Array<{ id: number; term_name: string; year: string; is_active: boolean }>>('/settings/academic-terms')
        .catch(() => []);
      const active = Array.isArray(terms) ? terms.find((t) => t.is_active) : null;

      if (settings?.current_term) {
        term = settings.current_term;
      } else if (active) {
        term = `${active.term_name} ${active.year}`;
        year = active.year;
      } else {
        term = defaultTerm;
        year = settings?.current_year || defaultYear;
      }
      if (settings?.current_year) {
        year = settings.current_year;
      }
      if (active) {
        academicTermId = active.id;
      }

      setCurrentTerm(term);
      setCurrentYear(year);
      setActiveAcademicTermId(academicTermId);
      setActiveTermCache(term, year);
    } catch {
      setCurrentTerm(defaultTerm);
      setCurrentYear(defaultYear);
      setActiveAcademicTermId(null);
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
    activeAcademicTermId != null ||
    (currentTerm !== defaultTerm && currentTerm.trim().length > 0);

  return (
    <ActiveTermContext.Provider
      value={{ currentTerm, currentYear, activeAcademicTermId, hasActiveTerm, isLoading, refresh }}
    >
      {children}
    </ActiveTermContext.Provider>
  );
};

export const useActiveTerm = () => useContext(ActiveTermContext);
