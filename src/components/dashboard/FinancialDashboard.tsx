import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import {
  getActiveAcademicTerm,
  getActiveAcademicYear,
  calculateStudentFeesSync,
  dateMatchesAcademicYearSetting,
  getDashboardCalendarYearForMonthlyChart,
} from '../../utils/feeCalculations';
import { formatDisplayDate } from '../../utils/dateFormat';
import FinancialSummary from './FinancialSummary';
import OutstandingFees from '../fees/OutstandingFees';
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
  ChevronLeft,
  ChevronRight,
  Wallet,
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
    <div className="flex h-[min(300px,38vh)] min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
      <Wallet className="mb-2 h-8 w-8 opacity-40" aria-hidden />
      {label}
    </div>
  );
}

const FinancialDashboard = () => {
  const { students, teachers, classes = [], payments, income, expenses, feeStructures, arrearsBalances } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  const termMatch = (term: string | undefined | null) => {
    const pt = term || '';
    return pt === currentTerm || pt.includes(currentTerm) || currentTerm.includes(pt);
  };

  const metrics = useMemo(() => {
    const feesCollected = payments.filter((p) => termMatch(p.term)).reduce((s, p) => s + p.amount, 0);

    const otherIncome = income
      .filter((inc) => inc.category !== 'Fee Payment')
      .filter((inc) => {
        const d = new Date(inc.date);
        return dateMatchesAcademicYearSetting(d, currentYear);
      })
      .reduce((s, inc) => s + inc.amount, 0);

    const totalCombinedIncome = feesCollected + otherIncome;

    const totalExpenses = expenses
      .filter((ex) => {
        const d = new Date(ex.paymentDate);
        return dateMatchesAcademicYearSetting(d, currentYear);
      })
      .reduce((s, ex) => s + ex.amount, 0);

    const balanceLeft = totalCombinedIncome - totalExpenses;

    const outstandingBalances = students.reduce((totalOwed, student) => {
      const feeCalc = calculateStudentFeesSync(
        student.id,
        currentTerm,
        student.classAssigned,
        feeStructures || [],
        payments || [],
        student.classAssignedId,
        arrearsBalances,
        {
          isBeneficiary: !!student.isBeneficiary,
          discountType: student.discountType,
          discountValue: student.discountValue,
        }
      );
      const outstanding = Math.max(0, (feeCalc.totalAmountDue ?? feeCalc.currentTermFee) - feeCalc.totalPaid);
      return totalOwed + outstanding;
    }, 0);

    return {
      feesCollected,
      otherIncome,
      totalCombinedIncome,
      totalExpenses,
      balanceLeft,
      outstandingBalances,
    };
  }, [payments, income, expenses, students, feeStructures, arrearsBalances, currentTerm, currentYear]);

  const monthlyFinance = useMemo(() => {
    const y = getDashboardCalendarYearForMonthlyChart(currentYear);
    return Array.from({ length: 12 }, (_, i) => {
      const month = new Date(parseInt(y, 10), i, 1).toLocaleDateString('en-US', { month: 'short' });
      const fees = payments
        .filter((p) => {
          const d = new Date(p.date);
          return d.getMonth() === i && d.getFullYear().toString() === y;
        })
        .reduce((s, p) => s + p.amount, 0);
      const other = income
        .filter((inc) => inc.category !== 'Fee Payment')
        .filter((inc) => {
          const d = new Date(inc.date);
          return d.getMonth() === i && d.getFullYear().toString() === y;
        })
        .reduce((s, inc) => s + inc.amount, 0);
      const exp = expenses
        .filter((ex) => {
          const d = new Date(ex.paymentDate);
          return d.getMonth() === i && d.getFullYear().toString() === y;
        })
        .reduce((s, ex) => s + ex.amount, 0);
      return { month, fees, otherIncome: other, income: fees + other, expenses: exp };
    });
  }, [payments, income, expenses, currentYear]);

  const expenseChartData = useMemo(() => {
    const acc = expenses
      .filter((ex) => dateMatchesAcademicYearSetting(new Date(ex.paymentDate), currentYear))
      .reduce(
        (a, expense) => {
          const c = expense.category || 'Other';
          a[c] = (a[c] || 0) + expense.amount;
          return a;
        },
        {} as Record<string, number>
      );
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [expenses, currentYear]);

  const classFeesData = useMemo(() => {
    const names = [...new Set(classes.map((c) => c.className).filter(Boolean))];
    return names.map((className) => ({
      name: className.length > 14 ? `${className.slice(0, 12)}…` : className,
      fullName: className,
      fees: payments
        .filter((p) => {
          const st = students.find((s) => s.id === p.studentId);
          return st && st.classAssigned === className && termMatch(p.term);
        })
        .reduce((s, p) => s + p.amount, 0),
    }));
  }, [classes, payments, students, currentTerm]);

  const recentActivities = useMemo(
    () =>
      [
        ...payments.slice(-5).map((payment) => {
          const student = students.find((s) => s.id === payment.studentId);
          return {
            text: `GHS ${payment.amount.toLocaleString()} fee — ${student?.firstName} ${student?.lastName}`,
            time: formatDisplayDate(payment.date),
            type: 'payment' as const,
            amount: payment.amount,
          };
        }),
        ...income
          .filter((inc) => inc.category !== 'Fee Payment')
          .slice(-3)
          .map((inc) => ({
            text: `GHS ${inc.amount.toLocaleString()} income — ${inc.source}`,
            time: formatDisplayDate(inc.date),
            type: 'income' as const,
            amount: inc.amount,
          })),
        ...expenses.slice(-3).map((expense) => ({
          text: `GHS ${expense.amount.toLocaleString()} — ${expense.title}`,
          time: formatDisplayDate(expense.paymentDate),
          type: 'expense' as const,
          amount: expense.amount,
        })),
      ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()),
    [payments, income, expenses, students]
  );

  const hasMonthly = monthlyFinance.some((m) => m.income > 0 || m.expenses > 0);
  const hasPie = expenseChartData.length > 0;
  const hasClass = classFeesData.some((c) => c.fees > 0);

  const termLabel = currentTerm.includes(currentYear) ? currentTerm : `${currentTerm} · ${currentYear}`;
  const monthlyChartCalendarYear = getDashboardCalendarYearForMonthlyChart(currentYear);

  const kpi = [
    {
      key: 'fees',
      label: 'Fees collected',
      value: `GHS ${metrics.feesCollected.toLocaleString()}`,
      sub: 'Current term',
      icon: CreditCard,
      ring: 'ring-emerald-500/25',
      bg: 'from-emerald-500/12 via-card to-card',
    },
    {
      key: 'other',
      label: 'Other income',
      value: `GHS ${metrics.otherIncome.toLocaleString()}`,
      sub: `Year ${currentYear}`,
      icon: TrendingUp,
      ring: 'ring-sky-500/25',
      bg: 'from-sky-500/12 via-card to-card',
    },
    {
      key: 'total',
      label: 'Total income',
      value: `GHS ${metrics.totalCombinedIncome.toLocaleString()}`,
      sub: 'Fees + other',
      icon: TrendingUp,
      ring: 'ring-violet-500/25',
      bg: 'from-violet-500/12 via-card to-card',
    },
    {
      key: 'exp',
      label: 'Total expenses',
      value: `GHS ${metrics.totalExpenses.toLocaleString()}`,
      sub: `Year ${currentYear}`,
      icon: TrendingDown,
      ring: 'ring-orange-500/25',
      bg: 'from-orange-500/12 via-card to-card',
    },
    {
      key: 'net',
      label: 'Net balance',
      value: `GHS ${metrics.balanceLeft.toLocaleString()}`,
      sub: 'Income − expenses',
      icon: Calculator,
      ring: metrics.balanceLeft >= 0 ? 'ring-indigo-500/25' : 'ring-amber-500/30',
      bg: metrics.balanceLeft >= 0 ? 'from-indigo-500/12 via-card to-card' : 'from-amber-500/15 via-card to-card',
    },
    {
      key: 'out',
      label: 'Outstanding',
      value: `GHS ${metrics.outstandingBalances.toLocaleString()}`,
      sub: 'Pending fees',
      icon: AlertCircle,
      ring: 'ring-rose-500/25',
      bg: 'from-rose-500/12 via-card to-card',
    },
  ];

  return (
    <div className="flex h-full min-h-0">
      <div className={`relative min-h-full flex-1 overflow-auto transition-all duration-300 ${sidebarOpen ? 'xl:mr-0' : ''}`}>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_70%_-10%,hsl(var(--primary)/0.1),transparent)] dark:bg-[radial-gradient(ellipse_70%_45%_at_70%_-10%,hsl(var(--primary)/0.16),transparent)]" />

        <div className="relative space-y-8 p-6 md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Finance dashboard</h1>
                <p className="mt-0.5 max-w-xl text-sm text-muted-foreground">
                  Income, expenses, and fee health — with live charts from your school data.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="font-normal">
                    {teachers.length} staff
                  </Badge>
                  <Badge variant="secondary" className="font-normal">
                    {students.length} students
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setSidebarOpen(!sidebarOpen)} variant="outline" className="gap-2 shadow-sm">
                <Users className="h-4 w-4" />
                Outstanding fees
                {sidebarOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
              <div className="rounded-xl border border-border/80 bg-card/90 px-4 py-2.5 text-right shadow-sm backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Billing term</p>
                <p className="text-sm font-semibold text-foreground">{termLabel}</p>
              </div>
            </div>
          </div>

          <FinancialSummary />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {kpi.map((k) => (
              <Card
                key={k.key}
                className={`overflow-hidden border-border/80 bg-gradient-to-br ${k.bg} shadow-md ring-1 ${k.ring}`}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                  <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</CardTitle>
                  <k.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="text-lg font-bold tabular-nums tracking-tight text-foreground md:text-xl">{k.value}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{k.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden border-border/80 shadow-md">
            <CardHeader className="border-b border-border/60 bg-muted/30">
              <CardTitle className="text-lg">Income & expense trend</CardTitle>
              <CardDescription>
                Monthly totals for calendar year {monthlyChartCalendarYear}
                {monthlyChartCalendarYear !== currentYear ? ` (active year: ${currentYear})` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {hasMonthly ? (
                <div className="h-[min(360px,44vh)] w-full min-h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={monthlyFinance} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="finIncomeArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                        axisLine={false}
                        tickLine={false}
                        width={48}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [`GHS ${Number(v).toLocaleString()}`, name]}
                        contentStyle={tooltipStyle}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="expenses" name="Expenses" fill="#fb923c" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      <Area type="monotone" dataKey="income" name="Total income" stroke="#4f46e5" fill="url(#finIncomeArea)" strokeWidth={2} />
                      <Line type="monotone" dataKey="fees" name="Fees only" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
                      <Line type="monotone" dataKey="otherIncome" name="Other income" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyChart label="No financial movements for this year yet." />
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card className="overflow-hidden border-border/80 shadow-md">
              <CardHeader className="border-b border-border/60 bg-muted/30">
                <CardTitle className="text-lg">Fees by class</CardTitle>
                <CardDescription>Current term collections</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {hasClass ? (
                  <div className="h-[min(320px,40vh)] w-full min-h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classFeesData} layout="vertical" margin={{ left: 4, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={96}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(v: number) => [`GHS ${Number(v).toLocaleString()}`, 'Fees']}
                          contentStyle={tooltipStyle}
                        />
                        <Bar dataKey="fees" fill="#10b981" radius={[0, 8, 8, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyChart label="No class-level fee collections for this term." />
                )}
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-border/80 shadow-md">
              <CardHeader className="border-b border-border/60 bg-muted/30">
                <CardTitle className="text-lg">Expense breakdown</CardTitle>
                <CardDescription>By category (all recorded expenses)</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                {hasPie ? (
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
            <Card className="border-border/80 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Recent activity</CardTitle>
                <CardDescription>Payments, income, and expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {recentActivities.slice(0, 12).map((activity, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/15 p-3 hover:bg-muted/30"
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
                        <p className="text-sm text-foreground">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <div
                        className={`shrink-0 text-sm font-semibold tabular-nums ${
                          activity.type === 'expense' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {activity.type === 'expense' ? '−' : '+'}GHS {activity.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-md">
              <CardHeader>
                <CardTitle className="text-lg">Quick actions</CardTitle>
                <CardDescription>Common finance workflows</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="h-11 w-full justify-start border border-emerald-500/25 bg-emerald-500/10 text-emerald-900 shadow-none hover:bg-emerald-500/15 dark:text-emerald-100">
                  <Receipt className="mr-2 h-4 w-4" />
                  Record fee payment
                </Button>
                <Button className="h-11 w-full justify-start border border-sky-500/25 bg-sky-500/10 text-sky-900 shadow-none hover:bg-sky-500/15 dark:text-sky-100">
                  <Plus className="mr-2 h-4 w-4" />
                  Add other income
                </Button>
                <Button className="h-11 w-full justify-start border border-rose-500/25 bg-rose-500/10 text-rose-900 shadow-none hover:bg-rose-500/15 dark:text-rose-100">
                  <FileText className="mr-2 h-4 w-4" />
                  Record expense
                </Button>
                <Button className="h-11 w-full justify-start border border-violet-500/25 bg-violet-500/10 text-violet-900 shadow-none hover:bg-violet-500/15 dark:text-violet-100">
                  <Calculator className="mr-2 h-4 w-4" />
                  Open reports
                </Button>
              </CardContent>
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
