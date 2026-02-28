import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { setActiveTermCache } from '../utils/feeCalculations';
import { useAuth } from './AuthContext';

interface ActiveTermContextType {
  currentTerm: string;
  currentYear: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const defaultTerm = 'Not Set';
const defaultYear = new Date().getFullYear().toString();

const ActiveTermContext = createContext<ActiveTermContextType>({
  currentTerm: defaultTerm,
  currentYear: defaultYear,
  isLoading: false,
  refresh: async () => {},
});

export const ActiveTermProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [currentTerm, setCurrentTerm] = useState(defaultTerm);
  const [currentYear, setCurrentYear] = useState(defaultYear);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      let term = defaultTerm;
      let year = defaultYear;

      const settings = await apiService.get<{ current_term?: string; current_year?: string }>('/settings');
      if (settings?.current_term) {
        term = settings.current_term;
      } else {
        const terms = await apiService.get<Array<{ term_name: string; year: string; is_active: boolean }>>('/settings/academic-terms');
        const active = Array.isArray(terms) ? terms.find((t: any) => t.is_active) : null;
        if (active) {
          term = `${active.term_name} ${active.year}`;
          year = active.year;
        } else {
          term = defaultTerm;
          year = settings?.current_year || defaultYear;
        }
      }
      if (settings?.current_year) {
        year = settings.current_year;
      }

      setCurrentTerm(term);
      setCurrentYear(year);
      setActiveTermCache(term, year);
    } catch {
      setCurrentTerm(defaultTerm);
      setCurrentYear(defaultYear);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    }
  }, [refresh, isAuthenticated]);

  return (
    <ActiveTermContext.Provider value={{ currentTerm, currentYear, isLoading, refresh }}>
      {children}
    </ActiveTermContext.Provider>
  );
};

export const useActiveTerm = () => useContext(ActiveTermContext);
