import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  getActiveAcademicTerm,
  getActiveAcademicYear,
  getDashboardCalendarYearForMonthlyChart,
} from '../../utils/feeCalculations';
import FinancialSummary from './FinancialSummary';
import { useAdminOverview, useFinancialSummary, useIncomeVsExpenditure } from '../../hooks/useReportQueries';
import {
  Users,
  CreditCard,
  AlertCircle,
  TrendingDown,
  GraduationCap,
  Plus,
  Receipt,
  FileText,
  LayoutDashboard,
  Sparkles,
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
  ComposedChart,
  Line,
  Area,
} from 'recharts';

const SERIES_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[min(320px,40vh)] min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
      <Sparkles className="mb-2 h-8 w-8 opacity-40" aria-hidden />
      {label}
    </div>
  );
}

const DashboardHome = () => {
  const { data: overview } = useAdminOverview();
  const { data: financial } = useFinancialSummary();
  const { data: monthlyRows = [] } = useIncomeVsExpenditure();

  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  const stats = useMemo(() => {
    const totalStudents = overview?.students.total ?? 0;
    const pendingStudents = overview?.students.pending ?? 0;
    const alumniStudents = overview?.students.alumni ?? 0;
    const totalTeachers = overview?.teachers.total ?? 0;
    const feesCollectedThisTerm = financial?.collected ?? 0;
    const otherIncomeThisYear = financial?.otherIncome ?? 0;
    const openingBalance = financial?.totalOpeningBalance ?? 0;
    const totalIncome = financial?.totalIncome ?? feesCollectedThisTerm + otherIncomeThisYear;
    const expensesThisYear = financial?.totalExpenses ?? 0;
    const netBalance =
      financial?.netBalance ?? openingBalance + totalIncome - expensesThisYear;
    const outstandingBalances = financial?.outstanding ?? 0;

    return {
      totalStudents,
      pendingStudents,
      alumniStudents,
      totalTeachers,
      feesCollectedThisTerm,
      otherIncomeThisYear,
      openingBalance,
      totalIncome,
      expensesThisYear,
      netBalance,
      outstandingBalances,
    };
  }, [overview, financial]);

  const classFeesData = useMemo(
    () =>
      (overview?.enrollmentByClass ?? []).map((row) => ({
        name: row.name,
        fullName: row.fullName,
        fees: 0,
        count: row.count,
      })),
    [overview]
  );

  const expenseChartData = useMemo(() => {
    if (!financial) return [];
    if (financial.totalExpenses <= 0) return [];
    return [{ name: 'Expenses', value: financial.totalExpenses }];
  }, [financial]);

  const monthlyCash = useMemo(() => {
    let runningBalance = stats.openingBalance;
    return monthlyRows.map((row) => {
      const income = Number(row.income) || 0;
      const expenses = Number(row.expense) || 0;
      runningBalance += income - expenses;
      return {
        month: row.name.split(' ')[0] ?? row.name,
        income,
        expenses,
        net: runningBalance,
      };
    });
  }, [monthlyRows, stats.openingBalance]);

  const recentActivities: Array<{ text: string; time: string; type: 'payment' | 'expense' }> = [];

  const hasMonthly = monthlyCash.some((m) => m.income > 0 || m.expenses > 0);
  const hasClassFees = classFeesData.some((c) => c.count > 0);
  const hasExpensePie = expenseChartData.length > 0;
  const monthlyChartCalendarYear = getDashboardCalendarYearForMonthlyChart(currentYear);

  return (
    <div className="relative min-h-full overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)] dark:bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.18),transparent)]" />

      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <LayoutDashboard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Dashboard</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">Overview, cash flow, and quick actions</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-4 py-2.5 shadow-sm backdrop-blur-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Active term</span>
            <span className="text-sm font-semibold text-foreground">{currentTerm}</span>
            <span className="text-border">·</span>
            <span className="text-sm text-muted-foreground">{currentYear}</span>
          </div>
        </div>

        <FinancialSummary />

        {/* KPI strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {[
            {
              label: 'Active Students',
              value: stats.totalStudents,
              sub:
                stats.pendingStudents || stats.alumniStudents
                  ? `${stats.pendingStudents} pending · ${stats.alumniStudents} alumni`
                  : 'Enrolled',
              icon: Users,
              accent: 'from-sky-500/20 to-sky-500/5 border-sky-500/25 text-sky-700 dark:text-sky-300',
            },
            {
              label: 'Total income',
              value: `GHS ${stats.totalIncome.toLocaleString()}`,
              sub: 'Fees + other',
              icon: CreditCard,
              accent: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-700 dark:text-emerald-300',
            },
            {
              label: 'Expenses',
              value: `GHS ${stats.expensesThisYear.toLocaleString()}`,
              sub: `Year ${currentYear}`,
              icon: TrendingDown,
              accent: 'from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-800 dark:text-amber-200',
            },
            {
              label: 'Net balance',
              value: `GHS ${stats.netBalance.toLocaleString()}`,
              sub: 'Opening + income − expenses',
              icon: CreditCard,
              accent:
                stats.netBalance >= 0
                  ? 'from-violet-500/20 to-violet-500/5 border-violet-500/25 text-violet-700 dark:text-violet-300'
                  : 'from-rose-500/20 to-rose-500/5 border-rose-500/25 text-rose-700 dark:text-rose-300',
            },
            {
              label: 'Outstanding',
              value: `GHS ${stats.outstandingBalances.toLocaleString()}`,
              sub: 'Fees pending',
              icon: AlertCircle,
              accent: 'from-orange-500/20 to-orange-500/5 border-orange-500/25 text-orange-800 dark:text-orange-200',
            },
            {
              label: 'Teachers',
              value: stats.totalTeachers,
              sub: 'Staff',
              icon: GraduationCap,
              accent: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/25 text-indigo-700 dark:text-indigo-300',
            },
          ].map((k) => (
            <Card
              key={k.label}
              className={`border bg-gradient-to-br ${k.accent} shadow-sm ring-1 ring-black/5 dark:ring-white/5`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</CardTitle>
                <k.icon className="h-4 w-4 opacity-70" />
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-xl font-bold tabular-nums tracking-tight text-foreground md:text-2xl">{k.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Cash flow — full width */}
        <Card className="overflow-hidden border-border/80 shadow-md">
          <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
            <CardTitle className="text-lg">Cash flow</CardTitle>
            <CardDescription>
              Income vs expenses by month for calendar year {monthlyChartCalendarYear}
              {monthlyChartCalendarYear !== currentYear ? ` (active year: ${currentYear})` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {hasMonthly ? (
              <div className="h-[min(340px,42vh)] w-full min-h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={monthlyCash} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="homeIncomeFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [`GHS ${Number(v).toLocaleString()}`, name]}
                      contentStyle={tooltipStyle}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="income" name="Income" stroke="#059669" fill="url(#homeIncomeFill)" strokeWidth={2} />
                    <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net balance (incl. opening)"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                      strokeDasharray="6 4"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyChart label="No payments or expenses recorded for this year yet." />
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden border-border/80 shadow-md">
            <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
              <CardTitle className="text-lg">Fees by class</CardTitle>
              <CardDescription>Collected in current term ({currentTerm})</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {hasClassFees ? (
                <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={classFeesData} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number) => [`GHS ${Number(v).toLocaleString()}`, 'Fees']}
                        contentStyle={tooltipStyle}
                        labelFormatter={(_, p) => (p?.[0]?.payload as { fullName?: string })?.fullName ?? ''}
                      />
                      <Bar dataKey="count" name="Students" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="No class fee collections for the current term yet." />
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-md">
            <CardHeader className="border-b border-border/60 bg-muted/30 pb-4">
              <CardTitle className="text-lg">Expense mix</CardTitle>
              <CardDescription>All-time categories (by amount)</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {hasExpensePie ? (
                <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={96}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {expenseChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={SERIES_COLORS[index % SERIES_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `GHS ${Number(v).toLocaleString()}`} contentStyle={tooltipStyle} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="No expenses recorded yet." />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="border-border/80 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Quick actions</CardTitle>
              <CardDescription>Shortcuts to common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="h-11 w-full justify-start border border-sky-500/25 bg-sky-500/10 text-sky-800 shadow-none hover:bg-sky-500/15 dark:text-sky-200">
                <Plus className="mr-2 h-4 w-4" />
                Add student
              </Button>
              <Button className="h-11 w-full justify-start border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 shadow-none hover:bg-emerald-500/15 dark:text-emerald-200">
                <Receipt className="mr-2 h-4 w-4" />
                Record payment
              </Button>
              <Button className="h-11 w-full justify-start border border-violet-500/25 bg-violet-500/10 text-violet-800 shadow-none hover:bg-violet-500/15 dark:text-violet-200">
                <FileText className="mr-2 h-4 w-4" />
                Add expense
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/80 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Recent activity</CardTitle>
              <CardDescription>Latest payments and expenses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentActivities.slice(0, 6).map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-3 transition-colors hover:bg-muted/35"
                  >
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activity.type === 'payment' ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug text-foreground">{activity.text}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{activity.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
