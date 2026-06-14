import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../contexts/SocketContext';
import { useSchool } from '../contexts/SchoolContext';

export const paymentAccountKeys = {
  all: (schoolId: number | null | undefined) => ['payment-accounts', schoolId] as const,
  balances: (schoolId: number | null | undefined) => ['payment-accounts', 'balances', schoolId] as const,
};

export const FINANCE_REALTIME_ENTITIES = new Set([
  'payment',
  'income',
  'expense',
  'payment-account',
  'fund-transfer',
  'finance',
  'fee',
  'finance-arrears',
]);

export function invalidateFinanceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  schoolId: number | null | undefined
) {
  if (schoolId == null) return;
  queryClient.invalidateQueries({ queryKey: ['reports'] });
  queryClient.invalidateQueries({ queryKey: paymentAccountKeys.all(schoolId) });
  queryClient.invalidateQueries({ queryKey: paymentAccountKeys.balances(schoolId) });
}

type UseFinanceRealtimeOptions = {
  onInvalidate?: () => void;
};

export function useFinanceRealtime(options?: UseFinanceRealtimeOptions) {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { schoolId } = useSchool();

  useEffect(() => {
    if (!socket || schoolId == null) return;

    const onChange = (evt: { entity?: string; tenantId?: number }) => {
      if (evt.tenantId != null && evt.tenantId !== schoolId) return;
      if (evt.entity && !FINANCE_REALTIME_ENTITIES.has(evt.entity)) return;
      invalidateFinanceQueries(queryClient, schoolId);
      options?.onInvalidate?.();
    };

    socket.on('tenant-data-changed', onChange);
    return () => {
      socket.off('tenant-data-changed', onChange);
    };
  }, [socket, schoolId, queryClient, options?.onInvalidate]);
}
