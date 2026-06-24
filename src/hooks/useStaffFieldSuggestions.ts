import { useCallback, useEffect, useState } from 'react';
import { fetchStaffFieldSuggestions, type StaffFieldType } from '../services/staffFieldApi';

export function useStaffFieldSuggestions(field: StaffFieldType) {
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchStaffFieldSuggestions(field);
      setNames(rows);
    } catch {
      setNames([]);
    } finally {
      setLoading(false);
    }
  }, [field]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { names, loading, refresh };
}
