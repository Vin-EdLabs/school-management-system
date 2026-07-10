import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';

export type FinancialSummaryData = {
  totalExpected: number;
  collected: number;
  feesCollectedPeriod?: number;
  outstanding: number;
  netBalance: number;
  systemNetPosition: number;
  cashOnHand?: number;
  periodActivityNet?: number;
  periodIncome?: number;
  totalIncome?: number;
  otherIncome: number;
  totalExpenses: number;
  totalOpeningBalance?: number;
  accountsTotal?: number;
  legacyUnlinkedNet?: number;
  collectionRate: number;
  academicYear: string;
  academicYearDisplay: string;
  financePeriodStart?: string;
  financePeriodEnd?: string;
  termLabel: string;
  accountSnapshots?: Array<{
    id: number;
    accountLabel: string;
    accountType: string;
    openingBalance: number;
    openingBalanceAsOf?: string | null;
    paymentsIn: number;
    incomeIn: number;
    expensesOut: number;
    transfersIn: number;
    transfersOut: number;
    currentBalance: number;
  }>;
  collectionsByAccount?: Array<{
    accountId: number | null;
    accountLabel: string;
    openingBalance: number;
    openingBalanceAsOf?: string | null;
    feesCollected: number;
    otherIncome: number;
    expenses: number;
    currentBalance: number;
  }>;
  fundTransfers?: Array<{
    id: number;
    amount: number;
    transfer_date: string;
    note: string;
    from_account_label: string;
    to_account_label: string;
    transferred_by_name?: string;
  }>;
};

export type AdminOverviewData = {
  students: {
    total: number;
    pending?: number;
    inactive?: number;
    alumni?: number;
    male: number;
    female: number;
    other: number;
  };
  teachers: { total: number; active?: number; monthlySalaryBudget?: number; male: number; female: number };
  otherStaff?: { total: number; active: number; male?: number; female?: number };
  maleStaff?: number;
  femaleStaff?: number;
  classes: { total: number };
  feeStatus: { paid: number; owing: number; noFee: number; credit: number; totalOwing: number };
  enrollmentByClass: { fullName: string; name: string; count: number }[];
  classNames: string[];
  paymentTrend?: Array<{ date: string; termFees: number; dailyFees: number; total: number }>;
};

export type StudentFeeRosterRow = {
  id: number;
  studentId: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  className: string;
  gender: string;
  enrollmentStatus: string;
  feeStatus: 'Fully Paid' | 'Amount Owing' | 'No Fee Set' | 'Credit Balance';
  balance: number;
};

export type IncomeVsExpenditureRow = {
  name: string;
  income: number;
  expense: number;
  fees?: number;
  otherIncome?: number;
};

export type FeesByClassRow = {
  id: number;
  name: string;
  students: number;
  expected: number;
  collected: number;
  outstanding: number;
};

export type ExpenditureCategoryRow = {
  name: string;
  value: number;
};

export type RecentFinanceActivityRow = {
  type: 'payment' | 'income' | 'expense';
  amount: number;
  label: string;
  tx_date: string;
  created_at: string;
};

function enabledForTenant(schoolId: number | null | undefined, active: boolean) {
  return active && schoolId != null;
}

function parseAmount(value: unknown): number {
  const n = parseFloat(String(value ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function normalizeFinancialSummary(raw: FinancialSummaryData): FinancialSummaryData {
  const feesCollectedPeriod = parseAmount(raw.feesCollectedPeriod ?? raw.collected);
  const otherIncome = parseAmount(raw.otherIncome);
  const totalExpenses = parseAmount(raw.totalExpenses);
  const collected = parseAmount(raw.collected);
  const periodIncome = parseAmount(raw.periodIncome) || feesCollectedPeriod + otherIncome;
  const totalIncome = parseAmount(raw.totalIncome) || collected + otherIncome;
  const totalOpeningBalance = parseAmount(raw.totalOpeningBalance);
  const netBalance =
    raw.netBalance != null || raw.systemNetPosition != null
      ? parseAmount(raw.netBalance ?? raw.systemNetPosition)
      : totalOpeningBalance + totalIncome - totalExpenses;

  return {
    ...raw,
    totalExpected: parseAmount(raw.totalExpected),
    collected,
    feesCollectedPeriod,
    outstanding: parseAmount(raw.outstanding),
    netBalance,
    systemNetPosition: parseAmount(raw.systemNetPosition) || netBalance,
    cashOnHand: parseAmount(raw.cashOnHand),
    periodActivityNet: parseAmount(raw.periodActivityNet) || netBalance,
    periodIncome,
    totalIncome,
    otherIncome,
    totalExpenses,
    totalOpeningBalance,
    accountsTotal: parseAmount(raw.accountsTotal),
    legacyUnlinkedNet: parseAmount(raw.legacyUnlinkedNet),
    collectionRate: parseAmount(raw.collectionRate),
    accountSnapshots: raw.accountSnapshots?.map((row) => ({
      ...row,
      openingBalance: parseAmount(row.openingBalance),
      paymentsIn: parseAmount(row.paymentsIn),
      incomeIn: parseAmount(row.incomeIn),
      expensesOut: parseAmount(row.expensesOut),
      transfersIn: parseAmount(row.transfersIn),
      transfersOut: parseAmount(row.transfersOut),
      currentBalance: parseAmount(row.currentBalance),
    })),
    collectionsByAccount: raw.collectionsByAccount?.map((row) => ({
      ...row,
      openingBalance: parseAmount(row.openingBalance),
      feesCollected: parseAmount(row.feesCollected),
      otherIncome: parseAmount(row.otherIncome),
      expenses: parseAmount(row.expenses),
      currentBalance: parseAmount(row.currentBalance),
    })),
    fundTransfers: raw.fundTransfers?.map((row) => ({
      ...row,
      amount: parseAmount(row.amount),
    })),
  };
}

export function useFinancialSummary(active = true) {
  const { schoolId } = useSchool();
  const { activeLedgerTermId } = useActiveTerm();
  return useQuery({
    queryKey: ['reports', 'financial-summary', schoolId, activeLedgerTermId],
    queryFn: async () => {
      const data = await apiService.get<FinancialSummaryData>('/reports/financial-summary');
      return normalizeFinancialSummary(data);
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useAdminOverview(active = true) {
  const { schoolId } = useSchool();
  const { activeLedgerTermId } = useActiveTerm();
  return useQuery({
    queryKey: ['reports', 'admin-overview', schoolId, activeLedgerTermId],
    queryFn: () => apiService.get<AdminOverviewData>('/reports/admin-overview'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useIncomeVsExpenditure(
  active = true,
  options?: { startDate?: string; endDate?: string }
) {
  const { schoolId } = useSchool();
  const startDate = options?.startDate ?? '';
  const endDate = options?.endDate ?? '';
  return useQuery({
    queryKey: ['reports', 'income-vs-expenditure', schoolId, startDate, endDate],
    queryFn: async () => {
      const q = new URLSearchParams();
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      const suffix = q.toString() ? `?${q.toString()}` : '';
      const rows = await apiService.get<Array<IncomeVsExpenditureRow & { other_income?: number }>>(
        `/reports/income-vs-expenditure${suffix}`
      );
      return (rows || []).map((row) => ({
        name: row.name,
        income: parseAmount(row.income),
        expense: parseAmount(row.expense),
        fees: parseAmount(row.fees),
        otherIncome: parseAmount(row.otherIncome ?? row.other_income),
      }));
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useFeesByClass(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'fees-by-class', schoolId],
    queryFn: async () => {
      const rows = await apiService.get<FeesByClassRow[]>('/reports/fees-by-class');
      return (rows || []).map((row) => ({
        ...row,
        students: parseAmount(row.students),
        expected: parseAmount(row.expected),
        collected: parseAmount(row.collected),
        outstanding: parseAmount(row.outstanding),
      }));
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useExpenditureByCategory(active = true, scope: 'all' | 'period' = 'all') {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'expenditure', schoolId, scope],
    queryFn: async () => {
      const suffix = scope === 'all' ? '?scope=all' : '';
      const rows = await apiService.get<ExpenditureCategoryRow[]>(`/reports/expenditure${suffix}`);
      return (rows || []).map((row) => ({
        name: row.name || 'Uncategorized',
        value: parseAmount(row.value),
      }));
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useRecentFinanceActivity(active = true, limit = 15) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'recent-finance-activity', schoolId, limit],
    queryFn: async () => {
      const rows = await apiService.get<RecentFinanceActivityRow[]>(
        `/reports/recent-finance-activity?limit=${limit}`
      );
      return (rows || []).map((row) => ({
        ...row,
        amount: parseAmount(row.amount),
      }));
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export function useStudentFeeRoster(
  params: { className?: string; search?: string },
  active = true
) {
  const { schoolId } = useSchool();
  const className = params.className ?? '';
  const search = params.search ?? '';
  return useQuery({
    queryKey: ['reports', 'student-fee-roster', schoolId, className, search],
    queryFn: () => {
      const q = new URLSearchParams();
      if (className && className !== 'all-classes') q.set('className', className);
      if (search.trim()) q.set('search', search.trim());
      const suffix = q.toString() ? `?${q.toString()}` : '';
      return apiService.get<StudentFeeRosterRow[]>(`/reports/student-fee-roster${suffix}`);
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 30_000,
  });
}

export function useOutstandingFeesReport(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'outstanding-fees', schoolId],
    queryFn: () =>
      apiService.get<Array<{ id: number; name: string; class: string; amount: number; days: number }>>(
        '/reports/outstanding-fees'
      ),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 15_000,
    refetchOnMount: 'always',
  });
}

export type AttendanceSummaryRow = { date: string; present: number; total: number };

export function useAttendanceSummary(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'attendance-summary', schoolId],
    queryFn: () => apiService.get<AttendanceSummaryRow[]>('/reports/attendance-summary'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 30_000,
  });
}

export type AcademicPerformanceData = {
  schoolAverage: number;
  classPerformance: Array<{ name: string; score: string | number }>;
  topPerformers: Array<{ name: string; class: string; score: string | number }>;
};

export function useAcademicPerformance(active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['reports', 'academic-performance', schoolId],
    queryFn: () => apiService.get<AcademicPerformanceData>('/reports/academic-performance'),
    enabled: enabledForTenant(schoolId, active),
    staleTime: 60_000,
  });
}

export type AuditLogItem = {
  id: number;
  created_at: string;
  action: string;
  summary?: string | null;
  username?: string | null;
  user_full_name?: string | null;
  module?: string | null;
  status?: string | null;
};

export function useRecentAuditLogs(limit = 8, active = true) {
  const { schoolId } = useSchool();
  return useQuery({
    queryKey: ['audit', 'recent', schoolId, limit],
    queryFn: async () => {
      const res = await apiService.get<{ items: AuditLogItem[] }>(`/audit?limit=${limit}&offset=0`);
      return res?.items ?? [];
    },
    enabled: enabledForTenant(schoolId, active),
    staleTime: 20_000,
  });
}
