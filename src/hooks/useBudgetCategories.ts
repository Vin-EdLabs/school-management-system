import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useSchool } from '../contexts/SchoolContext';
import { fetchBudgetCategories, type BudgetCategory } from '../services/termBudgetApi';

export function useBudgetCategories(type: 'income' | 'expense') {
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const { schoolId } = useSchool();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchBudgetCategories(type);
      setCategories(rows);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || schoolId == null) return;
    const onChange = (evt: { entity?: string; tenantId?: number }) => {
      if (evt.tenantId != null && evt.tenantId !== schoolId) return;
      if (evt.entity === 'term-budget' || evt.entity === 'income' || evt.entity === 'expense') {
        void refresh();
      }
    };
    socket.on('tenant-data-changed', onChange);
    return () => {
      socket.off('tenant-data-changed', onChange);
    };
  }, [socket, schoolId, refresh]);

  return { categories, categoryNames: categories.map((c) => c.name), loading, refresh };
}
