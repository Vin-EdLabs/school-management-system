import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { useSchool } from '../contexts/SchoolContext';
import type { PaymentAccount, PaymentAccountBalance } from '../utils/paymentAccounts';
import { invalidateFinanceQueries, paymentAccountKeys } from './useFinanceRealtime';

type BalancesResponse = {
  accounts: PaymentAccountBalance[];
  totalBalance: number;
  accountsTotal?: number;
  legacyUnlinkedNet?: number;
};

export function usePaymentAccounts(options?: { includeBalances?: boolean }) {
  const { schoolId } = useSchool();
  const queryClient = useQueryClient();

  const accountsQuery = useQuery({
    queryKey: paymentAccountKeys.all(schoolId),
    queryFn: () => apiService.get<PaymentAccount[]>('/payment-accounts'),
    enabled: schoolId != null,
    staleTime: 30_000,
  });

  const balancesQuery = useQuery({
    queryKey: paymentAccountKeys.balances(schoolId),
    queryFn: () => apiService.get<BalancesResponse>('/payment-accounts/balances'),
    enabled: schoolId != null && !!options?.includeBalances,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    invalidateFinanceQueries(queryClient, schoolId);
    await Promise.all([
      queryClient.refetchQueries({ queryKey: paymentAccountKeys.all(schoolId) }),
      options?.includeBalances
        ? queryClient.refetchQueries({ queryKey: paymentAccountKeys.balances(schoolId) })
        : Promise.resolve(),
    ]);
  }, [queryClient, schoolId, options?.includeBalances]);

  const accounts = accountsQuery.data || [];
  const balances = balancesQuery.data?.accounts || [];
  const totalBalance = Number(balancesQuery.data?.totalBalance ?? 0);
  const loading = accountsQuery.isLoading || (!!options?.includeBalances && balancesQuery.isLoading);
  const error =
    (accountsQuery.error as Error | null)?.message ||
    (balancesQuery.error as Error | null)?.message ||
    null;
  const defaultAccount =
    accounts.find((a) => a.is_default) ||
    accounts.find((a) => a.account_type === 'cash') ||
    accounts[0];

  return {
    accounts,
    balances,
    totalBalance,
    accountsTotal: balancesQuery.data?.accountsTotal,
    legacyUnlinkedNet: balancesQuery.data?.legacyUnlinkedNet,
    defaultAccount,
    loading,
    error,
    refresh,
  };
}
