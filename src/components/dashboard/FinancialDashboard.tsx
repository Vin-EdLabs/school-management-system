import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getDashboardCalendarYearForMonthlyChart } from '../../utils/feeCalculations';
import { formatDisplayDate } from '../../utils/dateFormat';
import OutstandingFees from '../fees/OutstandingFees';
import StaffPortalMessagesChip from '../chat/StaffPortalMessagesChip';
import { useAuth } from '../../contexts/AuthContext';
import {
  useAdminOverview,
  useExpenditureByCategory,
  useFeesByClass,
  useFinancialSummary,
  useIncomeVsExpenditure,
  useRecentFinanceActivity,
  useOutstandingFeesSummary,
} from '../../hooks/useReportQueries';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { useFinanceRealtime } from '../../hooks/useFinanceRealtime';
import { fetchUnreadBudgetAlerts } from '../../services/termBudgetApi';
import { cn } from '@/lib/utils';
import StaffAttendanceClockCard from '../staffAttendance/StaffAttendanceClockCard';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertCircle,
  Receipt,
  FileText,
  Plus,
  Users,
  ChevronRight,
  Wallet,
  Landmark,
  RefreshCw,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
  CircleCheck,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  ReferenceLine,
} from 'recharts';

const SERIES_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const CHART_COLORS = {
  received: '#10b981',
  spent: '#f97316',
  balance: '#4f46e5',
  opening: '#14b8a6',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

const surfaceCard =
  'rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 dark:shadow-none dark:ring-1 dark:ring-border/50';

function formatGhs(value: number) {
  return `GHS ${Number(value || 0).toLocaleString()}`;
}

function formatGhsCompact(value: number) {
  return `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatAxisAmount(value: number) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

type MonthlyRow = {
  month: string;
  income: number;
  expenses: number;
  periodNet: number;
  net: number;
};

function MoneyInOutTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyRow }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <p className="text-emerald-600 dark:text-emerald-400">Money received: {formatGhs(row.income)}</p>
      <p className="text-orange-600 dark:text-orange-400">Money spent: {formatGhs(row.expenses)}</p>
      <p className="mt-1.5 text-muted-foreground">
        Difference this month:{' '}
        <span className={row.periodNet >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
          {row.periodNet >= 0 ? '+' : ''}
          {formatGhs(row.periodNet)}
        </span>
      </p>
    </div>
  );
}

function BalanceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ payload: MonthlyRow & { openingBalance?: number } }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <p className="font-medium text-indigo-600 dark:text-indigo-400">Balance at month end: {formatGhs(row.net)}</p>
      {row.periodNet !== 0 && (
        <p className="mt-1 text-muted-foreground">
          Change this month: {row.periodNet >= 0 ? '+' : ''}
          {formatGhs(row.periodNet)}
        </p>
      )}
    </div>
  );
}

function ChartSummaryStrip({
  opening,
  received,
  spent,
  balance,
  yearLabel,
}: {
  opening: number;
  received: number;
  spent: number;
  balance: number;
  yearLabel: string;
}) {
  const items = [
    { label: 'Started with (opening)', value: opening, color: 'text-teal-600 dark:text-teal-400' },
    { label: `Received in ${yearLabel}`, value: received, color: 'text-emerald-600 dark:text-emerald-400' },
    { label: `Spent in ${yearLabel}`, value: spent, color: 'text-orange-600 dark:text-orange-400' },
    { label: `Balance (${yearLabel})`, value: balance, color: balance >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-2xl border border-border/60 bg-card/80 px-5 py-4 shadow-sm"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
          <p className={`mt-2 text-xl font-bold tabular-nums sm:text-2xl ${item.color}`}>{formatGhs(item.value)}</p>
        </div>
      ))}
    </div>
  );
}

type FinanceMetricAccent = 'emerald' | 'sky' | 'violet' | 'teal' | 'orange' | 'indigo' | 'amber' | 'rose';

const KPI_BORDER: Record<FinanceMetricAccent, { border: string; iconBg: string }> = {
  emerald: { border: 'border-l-emerald-600 dark:border-l-emerald-500', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  sky: { border: 'border-l-sky-500', iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  violet: { border: 'border-l-violet-600 dark:border-l-violet-400', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  teal: { border: 'border-l-teal-500', iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  orange: { border: 'border-l-orange-500', iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  indigo: { border: 'border-l-indigo-600 dark:border-l-indigo-400', iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  amber: { border: 'border-l-amber-500', iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  rose: { border: 'border-l-rose-500', iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[min(300px,38vh)] min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
      <Wallet className="mb-2 h-8 w-8 opacity-40" aria-hidden />
      {label}
    </div>
  );
}

function formatActivityTime(txDate: string, createdAt: string) {
  const raw = createdAt || txDate;
  if (!raw) return '';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return formatDisplayDate(txDate);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function activityLabel(type: 'payment' | 'income' | 'expense', label: string) {
  const text = label?.trim() || 'Record';
  if (type === 'payment') return `Fee payment · ${text}`;
  if (type === 'income') return `Income · ${text}`;
  return `Expense · ${text}`;
}

function ChartSkeleton() {
  return (
    <div className="flex h-[min(360px,44vh)] min-h-[260px] flex-col items-center justify-center gap-3">
      <Skeleton className="h-[220px] w-full max-w-md rounded-xl" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

type FinancialDashboardProps = {
  onNavigate?: (module: string) => void;
};

const FinancialDashboard = ({ onNavigate }: FinancialDashboardProps) => {
  const { user } = useAuth();
  const { data: overview } = useAdminOverview();
  const { data: outstandingSummary } = useOutstandingFeesSummary();
  const {
    data: financial,
    isLoading: financialLoading,
    isFetching: financialFetching,
    isError: financialError,
    refetch: refetchFinancial,
  } = useFinancialSummary();
  const { currentTerm, currentYear, isLoading: termLoading } = useActiveTerm();
  const monthlyChartCalendarYear = getDashboardCalendarYearForMonthlyChart(currentYear);
  const chartStartDate = `${monthlyChartCalendarYear}-01-01`;
  const chartEndDate = `${monthlyChartCalendarYear}-12-31`;

  const {
    data: monthlyRows = [],
    isLoading: monthlyLoading,
    refetch: refetchMonthly,
  } = useIncomeVsExpenditure(true, { startDate: chartStartDate, endDate: chartEndDate });
  const { data: feesByClass = [], isLoading: feesByClassLoading, refetch: refetchFeesByClass } = useFeesByClass();
  const {
    data: expenseCategories = [],
    isLoading: expenseCategoriesLoading,
    refetch: refetchExpenses,
  } = useExpenditureByCategory(true, 'all');
  const { data: recentActivities = [], isLoading: activityLoading, refetch: refetchActivity } =
    useRecentFinanceActivity();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [budgetAlerts, setBudgetAlerts] = useState<Array<Record<string, unknown>>>([]);

  const loadBudgetAlerts = useCallback(async () => {
    try {
      const res = await fetchUnreadBudgetAlerts();
      setBudgetAlerts(res.alerts || []);
    } catch {
      setBudgetAlerts([]);
    }
  }, []);

  useEffect(() => {
    void loadBudgetAlerts();
  }, [loadBudgetAlerts]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchFinancial(),
        refetchMonthly(),
        refetchFeesByClass(),
        refetchExpenses(),
        refetchActivity(),
        loadBudgetAlerts(),
      ]);
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refetchFinancial, refetchMonthly, refetchFeesByClass, refetchExpenses, refetchActivity, loadBudgetAlerts]);

  const refreshRef = useRef(handleRefresh);
  refreshRef.current = handleRefresh;
  useFinanceRealtime({
    onInvalidate: () => {
      void refreshRef.current();
    },
  });

  const metrics = useMemo(() => {
    // Dashboard keeps school-wide carried totals; term activity lives in finance reports.
    const feesCollected = financial?.collectedAll ?? financial?.collected ?? 0;
    const otherIncome = financial?.otherIncomeAll ?? financial?.otherIncome ?? 0;
    const openingBalance = financial?.totalOpeningBalance ?? 0;
    const totalCombinedIncome = feesCollected + otherIncome;
    const totalExpenses = financial?.totalExpensesAll ?? financial?.totalExpenses ?? 0;
    const balanceLeft =
      financial?.systemNetPosition ??
      financial?.netBalance ??
      openingBalance + totalCombinedIncome - totalExpenses;
    const outstandingBalances =
      outstandingSummary?.totalOutstanding ?? financial?.outstanding ?? 0;

    return {
      feesCollected,
      otherIncome,
      openingBalance,
      totalCombinedIncome,
      totalExpenses,
      balanceLeft,
      outstandingBalances,
    };
  }, [financial, outstandingSummary]);

  const monthlyFinance = useMemo(() => {
    let runningBalance = metrics.openingBalance;
    return monthlyRows.map((row) => {
      const fees = Number(row.fees) || 0;
      const otherIncome = Number(row.otherIncome) || 0;
      const income = Number(row.income) || fees + otherIncome;
      const expenses = Number(row.expense) || 0;
      const periodNet = income - expenses;
      runningBalance += periodNet;
      return {
        month: row.name.split(' ')[0] ?? row.name,
        fees,
        otherIncome,
        income,
        expenses,
        periodNet,
        net: runningBalance,
      };
    });
  }, [monthlyRows, metrics.openingBalance]);

  const chartYearSummary = useMemo(() => {
    const received = monthlyFinance.reduce((sum, row) => sum + row.income, 0);
    const spent = monthlyFinance.reduce((sum, row) => sum + row.expenses, 0);
    const endBalance =
      monthlyFinance.length > 0
        ? monthlyFinance[monthlyFinance.length - 1].net
        : metrics.openingBalance;
    return {
      received,
      spent,
      endBalance,
      yearNet: received - spent,
    };
  }, [monthlyFinance, metrics.openingBalance]);

  const balanceTrend = useMemo(
    () => monthlyFinance.map((row) => ({ ...row, openingBalance: metrics.openingBalance })),
    [monthlyFinance, metrics.openingBalance]
  );

  const moneyFlowMonths = useMemo(
    () => monthlyFinance.filter((row) => row.income > 0 || row.expenses > 0),
    [monthlyFinance]
  );

  const expenseChartData = useMemo(
    () => expenseCategories.filter((row) => row.value > 0),
    [expenseCategories]
  );

  const incomeComposition = useMemo(() => {
    const items = [];
    if (metrics.feesCollected > 0) items.push({ name: 'Fees collected', value: metrics.feesCollected });
    if (metrics.otherIncome > 0) items.push({ name: 'Other income', value: metrics.otherIncome });
    return items;
  }, [metrics.feesCollected, metrics.otherIncome]);

  const classFeesData = useMemo(
    () =>
      feesByClass
        .filter((row) => row.collected > 0)
        .sort((a, b) => b.collected - a.collected)
        .slice(0, 12)
        .map((row) => ({
          name: row.name.length > 14 ? `${row.name.slice(0, 12)}…` : row.name,
          fullName: row.name,
          collected: row.collected,
          students: row.students,
        })),
    [feesByClass]
  );

  const hasMonthly =
    metrics.openingBalance > 0 ||
    monthlyFinance.some((m) => m.income > 0 || m.expenses > 0);
  const hasExpensePie = expenseChartData.length > 0;
  const hasIncomePie = incomeComposition.length > 0;
  const hasClassFees = classFeesData.length > 0;
  const isRefreshing = refreshing || financialFetching;

  const kpi: Array<{
    key: string;
    label: string;
    value: number;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
    accent: FinanceMetricAccent;
  }> = [
    {
      key: 'fees',
      label: 'Fees collected',
      value: metrics.feesCollected,
      sub: 'All terms (transactions)',
      icon: CreditCard,
      accent: 'emerald',
    },
    {
      key: 'other',
      label: 'Other income',
      value: metrics.otherIncome,
      sub: 'All recorded income',
      icon: TrendingUp,
      accent: 'sky',
    },
    {
      key: 'total',
      label: 'Total income',
      value: metrics.totalCombinedIncome,
      sub: 'Fees + other (carried forward)',
      icon: TrendingUp,
      accent: 'violet',
    },
    {
      key: 'opening',
      label: 'Opening balance',
      value: metrics.openingBalance,
      sub: 'Payment accounts',
      icon: Landmark,
      accent: 'teal',
    },
    {
      key: 'exp',
      label: 'Total expenses',
      value: metrics.totalExpenses,
      sub: 'All recorded expenses',
      icon: TrendingDown,
      accent: 'orange',
    },
    {
      key: 'net',
      label: 'Net balance',
      value: metrics.balanceLeft,
      sub: 'Opening + all income − expenses',
      icon: Calculator,
      accent: metrics.balanceLeft >= 0 ? 'indigo' : 'amber',
    },
    {
      key: 'out',
      label: 'Outstanding',
      value: metrics.outstandingBalances,
      sub: 'From Outstanding Fees',
      icon: AlertCircle,
      accent: 'rose',
    },
  ];

  const displayName = user?.fullName || user?.username || 'Finance';
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const nav = useCallback(
    (module: string) => {
      if (onNavigate) {
        onNavigate(module);
      }
    },
    [onNavigate]
  );

  return (
    <div className="min-h-full bg-[#FAFAFA] dark:bg-background">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
        {budgetAlerts.length > 0 && (
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  Budget alerts ({budgetAlerts.length})
                </p>
                <ul className="mt-1 space-y-1">
                  {budgetAlerts.slice(0, 3).map((a) => (
                    <li key={String(a.id)} className="text-xs text-amber-800 dark:text-amber-200">
                      {String(a.message || a.category_name)}
                    </li>
                  ))}
                </ul>
                {budgetAlerts.length > 3 && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    +{budgetAlerts.length - 3} more — open Budget for details
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2 h-8 rounded-lg text-xs"
                  onClick={() => nav('term-budget')}
                >
                  Open budget
                </Button>
              </div>
            </div>
          </div>
        )}
        {financialError && (
          <div className="rounded-xl border border-amber-300/80 bg-amber-50/90 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900 dark:text-amber-100">
                Live finance summary could not be loaded. Showing cached totals where available.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => void refetchFinancial()}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className={cn(surfaceCard, 'border-l-4 border-l-emerald-600 p-5 dark:border-l-emerald-500 md:p-6')}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
                {greeting()}, {displayName.split(' ')[0]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 font-normal">
                  <Calendar className="h-3 w-3" />
                  {termLoading
                    ? 'Loading term…'
                    : currentYear && !currentTerm.includes(currentYear)
                      ? `${currentTerm} · ${currentYear}`
                      : currentTerm}
                </Badge>
                <Badge className="gap-1.5 rounded-full border-0 bg-emerald-600 px-3 py-1 font-normal text-white hover:bg-emerald-600">
                  <CircleCheck className="h-3 w-3" />
                  Finance Portal
                </Badge>
                {lastSync && (
                  <Badge variant="secondary" className="rounded-full px-3 py-1 font-normal">
                    Updated {lastSync.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              {onNavigate ? (
                <StaffPortalMessagesChip
                  onNavigate={onNavigate}
                  variant="light"
                  className="w-full sm:min-w-[220px] sm:max-w-[260px]"
                />
              ) : null}
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg"
                  onClick={() => void handleRefresh()}
                  disabled={isRefreshing}
                >
                  <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
                  Refresh
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg border-violet-500/30 text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30"
                  onClick={() => nav('messages')}
                >
                  <MessageCircle className="h-4 w-4" /> Messages
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9 gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => nav('fees')}
                >
                  <Plus className="h-4 w-4" /> Record Payment
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg"
                  onClick={() => nav('expenses')}
                >
                  <FileText className="h-4 w-4" /> Expenses
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-lg"
                  onClick={() => setSidebarOpen(true)}
                >
                  <Users className="h-4 w-4" /> Outstanding
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-4 md:overflow-visible xl:grid-cols-7">
          {financialLoading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className={cn(surfaceCard, 'min-w-[200px] flex-shrink-0 snap-start border-l-4 p-4 md:min-w-0')}>
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-7 w-28" />
                  <Skeleton className="mt-2 h-3 w-20" />
                </div>
              ))
            : kpi.map((k) => {
                const styles = KPI_BORDER[k.accent];
                return (
                  <div
                    key={k.key}
                    className={cn(
                      surfaceCard,
                      'min-w-[200px] flex-shrink-0 snap-start border-l-4 p-4 hover:-translate-y-0.5 md:min-w-0',
                      styles.border
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
                        {k.label}
                      </p>
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', styles.iconBg)}>
                        <k.icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p
                      className="mt-1.5 text-base font-bold tabular-nums leading-tight text-foreground sm:text-lg"
                      title={formatGhs(k.value)}
                    >
                      {formatGhsCompact(k.value)}
                    </p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{k.sub}</p>
                  </div>
                );
              })}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm ring-1 ring-border/40">
            <CardHeader className="border-b border-border/60 bg-gradient-to-r from-indigo-500/8 via-card to-violet-500/8 px-6 py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5 text-indigo-500" />
                    How your money moves
                  </CardTitle>
                  <CardDescription className="max-w-2xl">
                    Simple view of money coming in, money going out, and the balance left in {monthlyChartCalendarYear}.
                    Opening balance is the cash you started with; the balance line shows what is left after each month.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="w-fit shrink-0 font-normal">
                  {monthlyChartCalendarYear}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 px-6 py-6">
              {monthlyLoading ? (
                <ChartSkeleton />
              ) : hasMonthly ? (
                <>
                  <ChartSummaryStrip
                    opening={metrics.openingBalance}
                    received={chartYearSummary.received}
                    spent={chartYearSummary.spent}
                    balance={chartYearSummary.endBalance}
                    yearLabel={monthlyChartCalendarYear}
                  />

                  <p className="text-center text-[11px] text-muted-foreground xl:text-left">
                    Figures below are for {monthlyChartCalendarYear} only. Summary cards above show all-time totals.
                  </p>

                  <div className="rounded-lg border border-border/60 bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">How to read this</p>
                    <ul className="mt-1.5 list-inside list-disc space-y-0.5">
                      <li>
                        <span className="text-emerald-600 dark:text-emerald-400">Green bars</span> — fees and other
                        income received that month
                      </li>
                      <li>
                        <span className="text-orange-600 dark:text-orange-400">Orange bars</span> — expenses paid that
                        month
                      </li>
                      <li>
                        <span className="text-indigo-600 dark:text-indigo-400">Purple line</span> — total cash left
                        (opening balance + all income − all expenses, built up month by month)
                      </li>
                    </ul>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                      <h3 className="mb-1 text-sm font-semibold text-foreground">Money in vs money out</h3>
                      <p className="mb-4 text-xs text-muted-foreground">Each month — compare what came in and what was spent</p>
                      {moneyFlowMonths.length > 0 ? (
                        <div className="h-[min(280px,36vh)] w-full min-h-[220px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={moneyFlowMonths} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis
                                dataKey="month"
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickFormatter={formatAxisAmount}
                                axisLine={false}
                                tickLine={false}
                                width={52}
                              />
                              <Tooltip content={<MoneyInOutTooltip />} />
                              <Legend wrapperStyle={{ fontSize: 12 }} />
                              <Bar
                                dataKey="income"
                                name="Money received"
                                fill={CHART_COLORS.received}
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                              />
                              <Bar
                                dataKey="expenses"
                                name="Money spent"
                                fill={CHART_COLORS.spent}
                                radius={[6, 6, 0, 0]}
                                maxBarSize={32}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <EmptyChart label="No payments or expenses recorded this year yet — balance stays at opening amount." />
                      )}
                    </div>

                    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                      <h3 className="mb-1 text-sm font-semibold text-foreground">Balance over time</h3>
                      <p className="mb-4 text-xs text-muted-foreground">
                        Running total — starts at opening balance ({formatGhs(metrics.openingBalance)})
                      </p>
                      <div className="h-[min(280px,36vh)] w-full min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={balanceTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                            <XAxis
                              dataKey="month"
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                              tickFormatter={formatAxisAmount}
                              axisLine={false}
                              tickLine={false}
                              width={52}
                            />
                            <Tooltip content={<BalanceTooltip />} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {metrics.openingBalance > 0 && (
                              <ReferenceLine
                                y={metrics.openingBalance}
                                stroke={CHART_COLORS.opening}
                                strokeDasharray="4 4"
                                label={{
                                  value: 'Opening',
                                  position: 'insideTopRight',
                                  fill: CHART_COLORS.opening,
                                  fontSize: 11,
                                }}
                              />
                            )}
                            <Line
                              type="monotone"
                              dataKey="net"
                              name="Cash balance"
                              stroke={CHART_COLORS.balance}
                              strokeWidth={2.5}
                              dot={{ r: 3, fill: CHART_COLORS.balance }}
                              activeDot={{ r: 5 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <EmptyChart label="No finance data yet. Set an opening balance or record income and expenses to see charts." />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm ring-1 ring-border/40">
              <CardHeader className="border-b border-border/60 bg-gradient-to-r from-emerald-500/8 via-card to-teal-500/8 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart3 className="h-5 w-5 text-emerald-500" />
                  Fees by class
                </CardTitle>
                <CardDescription>This term ({currentTerm}) — class breakdown</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                {feesByClassLoading ? (
                  <ChartSkeleton />
                ) : hasClassFees ? (
                  <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classFeesData} layout="vertical" margin={{ left: 4, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={96}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v: number) => [`GHS ${Number(v).toLocaleString()}`, 'Collected']}
                          labelFormatter={(_, p) => (p?.[0]?.payload as { fullName?: string })?.fullName ?? ''}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="collected" name="Collected" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No class fee collections for this term yet." />
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm ring-1 ring-border/40">
              <CardHeader className="border-b border-border/60 bg-gradient-to-r from-orange-500/8 via-card to-rose-500/8 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="h-5 w-5 text-orange-500" />
                  Expense breakdown
                </CardTitle>
                <CardDescription>By category (all recorded expenses)</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                {expenseCategoriesLoading ? (
                  <ChartSkeleton />
                ) : hasExpensePie ? (
                  <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={92}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        >
                          {expenseChartData.map((_, index) => (
                            <Cell key={`c-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `GHS ${Number(v).toLocaleString()}`} contentStyle={tooltipStyle} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No expenses to chart yet." />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm ring-1 ring-border/40">
              <CardHeader className="border-b border-border/60 bg-gradient-to-r from-violet-500/8 via-card to-indigo-500/8 px-6 py-5">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <PieChartIcon className="h-5 w-5 text-violet-500" />
                  Income composition
                </CardTitle>
                <CardDescription>Fees vs other income</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                {financialLoading ? (
                  <ChartSkeleton />
                ) : hasIncomePie ? (
                  <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={incomeComposition}
                          cx="50%"
                          cy="50%"
                          innerRadius={56}
                          outerRadius={92}
                          paddingAngle={3}
                          dataKey="value"
                          nameKey="name"
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        >
                          {incomeComposition.map((_, index) => (
                            <Cell key={`inc-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `GHS ${Number(v).toLocaleString()}`} contentStyle={tooltipStyle} />
                        <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No income recorded yet." />
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden rounded-2xl border-border/80 shadow-sm ring-1 ring-border/40">
              <CardHeader className="border-b border-border/60 bg-muted/30 px-6 py-5">
                <CardTitle className="text-lg">Recent activity</CardTitle>
                <CardDescription>Latest payments, income, and expenses</CardDescription>
              </CardHeader>
              <CardContent className="px-6 py-6">
                {activityLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full rounded-lg" />
                    ))}
                  </div>
                ) : recentActivities.length > 0 ? (
                  <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                    {recentActivities.slice(0, 12).map((activity, index) => (
                      <div
                        key={`${activity.type}-${activity.created_at}-${index}`}
                        className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 transition-colors hover:bg-muted/30"
                      >
                        <div
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            activity.type === 'payment'
                              ? 'bg-emerald-500'
                              : activity.type === 'income'
                                ? 'bg-sky-500'
                                : 'bg-rose-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-foreground">
                            {activityLabel(activity.type, activity.label)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatActivityTime(activity.tx_date, activity.created_at)}
                          </p>
                        </div>
                        <div
                          className={`shrink-0 text-sm font-semibold tabular-nums ${
                            activity.type === 'expense'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {activity.type === 'expense' ? '−' : '+'}GHS {activity.amount.toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyChart label="No finance activity yet. Record a payment, income, or expense." />
                )}
              </CardContent>
            </Card>
          </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <StaffAttendanceClockCard
              variant="sidebar"
              onOpenHistory={onNavigate ? () => onNavigate('my-staff-attendance') : undefined}
            />

            {onNavigate ? (
              <StaffPortalMessagesChip
                onNavigate={onNavigate}
                variant="light"
                className="w-full"
              />
            ) : null}

            <Card className={cn(surfaceCard, 'border-l-4 border-l-red-500 p-5')}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-foreground">Outstanding Fees</h3>
              </div>
              {financialLoading ? (
                <Skeleton className="mt-3 h-12" />
              ) : metrics.outstandingBalances <= 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No outstanding balances recorded.</p>
              ) : (
                <>
                  <p className="mt-2 text-lg font-bold tabular-nums leading-tight text-red-600 dark:text-red-400" title={formatGhs(metrics.outstandingBalances)}>
                    {formatGhsCompact(metrics.outstandingBalances)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Total unpaid fee balances</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setSidebarOpen(true)}>
                      View breakdown
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => nav('fees')}>
                      Collect fees
                    </Button>
                  </div>
                </>
              )}
            </Card>

            <Card className={cn(surfaceCard, 'p-5')}>
              <h3 className="text-sm font-semibold text-foreground">School snapshot</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Active staff</span>
                  <span className="font-medium tabular-nums">{overview?.teachers.active ?? overview?.teachers.total ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Students</span>
                  <span className="font-medium tabular-nums">{overview?.students.total ?? 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Net balance</span>
                  <span className={cn('font-semibold tabular-nums', metrics.balanceLeft >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                    {formatGhsCompact(metrics.balanceLeft)}
                  </span>
                </div>
              </div>
            </Card>

            <Card className={cn(surfaceCard, 'p-5')}>
              <h3 className="text-sm font-semibold text-foreground">Quick actions</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Common finance workflows</p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-violet-500/25 bg-violet-500/5 text-sm hover:bg-violet-500/10"
                  onClick={() => nav('messages')}
                >
                  <MessageCircle className="h-4 w-4 shrink-0 text-violet-600" />
                  Staff messages
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-emerald-500/25 bg-emerald-500/5 text-sm hover:bg-emerald-500/10"
                  onClick={() => nav('fees')}
                >
                  <Receipt className="h-4 w-4 shrink-0 text-emerald-600" />
                  Record fee payment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-sky-500/25 bg-sky-500/5 text-sm hover:bg-sky-500/10"
                  onClick={() => nav('income')}
                >
                  <Plus className="h-4 w-4 shrink-0 text-sky-600" />
                  Add other income
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-rose-500/25 bg-rose-500/5 text-sm hover:bg-rose-500/10"
                  onClick={() => nav('expenses')}
                >
                  <FileText className="h-4 w-4 shrink-0 text-rose-600" />
                  Record expense
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-violet-500/25 bg-violet-500/5 text-sm hover:bg-violet-500/10"
                  onClick={() => nav('cash-bank')}
                >
                  <Landmark className="h-4 w-4 shrink-0 text-violet-600" />
                  Cash &amp; bank
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-indigo-500/25 bg-indigo-500/5 text-sm hover:bg-indigo-500/10"
                  onClick={() => nav('reports')}
                >
                  <Calculator className="h-4 w-4 shrink-0 text-indigo-600" />
                  Open reports
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-amber-500/25 bg-amber-500/5 text-sm hover:bg-amber-500/10"
                  onClick={() => nav('term-budget')}
                >
                  <TrendingUp className="h-4 w-4 shrink-0 text-amber-600" />
                  Budget
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 justify-start gap-2 rounded-lg border-teal-500/25 bg-teal-500/5 text-sm hover:bg-teal-500/10"
                  onClick={() => nav('finance-statement')}
                >
                  <FileText className="h-4 w-4 shrink-0 text-teal-600" />
                  Finance statement
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {sidebarOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} aria-hidden />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[min(640px,100vw)] flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Outstanding fees</h2>
                <p className="text-sm text-muted-foreground">Class breakdown and arrears</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSidebarOpen(false)} aria-label="Close">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <OutstandingFees />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialDashboard;
