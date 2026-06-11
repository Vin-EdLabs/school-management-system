import { useEffect, useRef } from 'react';
import { useData, type DataDomain } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';

/** Load only the DataContext domains required by the current page. */
export function useEnsureData(domains: DataDomain[]) {
  const { loadDomains } = useData();
  const { isAuthenticated } = useAuth();
  const { schoolId } = useSchool();
  const lastKeyRef = useRef('');

  const key = domains.slice().sort().join(',');

  useEffect(() => {
    lastKeyRef.current = '';
  }, [schoolId]);

  useEffect(() => {
    if (!isAuthenticated || schoolId == null || domains.length === 0) return;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    void loadDomains(domains);
  }, [isAuthenticated, schoolId, key, domains, loadDomains]);
}
