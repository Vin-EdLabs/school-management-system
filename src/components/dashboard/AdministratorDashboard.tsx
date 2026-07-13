import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import {
  useAdminOverview,
  useAttendanceSummary,
  useAcademicPerformance,
  useRecentAuditLogs,
  useOutstandingFeesSummary,
} from '../../hooks/useReportQueries';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import { apiService } from '../../services/api';
import { formatDisplayDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import {
  Users,
  GraduationCap,
  DollarSign,
  Briefcase,
  CalendarCheck,
  TrendingUp,
  Plus,
  Megaphone,
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Cake,
  RefreshCw,
  Calendar,
  CircleCheck,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Label,
} from 'recharts';
import type { PersonalTodo } from '../todos/PersonalTodosPanel';
import { countTodayPendingTodos } from '../todos/PersonalTodosPanel';
import StaffAttendanceClockCard from '../staffAttendance/StaffAttendanceClockCard';

const CHART_GREEN = '#10b981';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: 12,
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const surfaceCard =
  'rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)] transition-all duration-200 dark:shadow-none dark:ring-1 dark:ring-border/50';

function formatGhs(n: number) {
  return `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Tighter currency display for KPI cards (no decimals, full amount) */
function formatGhsCompact(n: number) {
  return `GHS ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function actionBadgeClass(action: string) {
  const a = (action || '').toUpperCase();
  if (a.includes('DELETE') || a.includes('REMOVE')) return 'bg-red-500/10 text-red-700 dark:text-red-400';
  if (a.includes('UPDATE') || a.includes('EDIT')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
  if (a.includes('PAYMENT') || a.includes('FEE')) return 'bg-violet-500/10 text-violet-700 dark:text-violet-400';
  if (a.includes('LOGIN')) return 'bg-muted text-muted-foreground';
  if (a.includes('CREATE') || a.includes('ADD')) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  return 'bg-muted text-muted-foreground';
}

function actionLabel(action: string) {
  const a = (action || '').toUpperCase();
  if (a.includes('DELETE')) return 'DELETE';
  if (a.includes('UPDATE') || a.includes('EDIT')) return 'UPDATE';
  if (a.includes('PAYMENT') || a.includes('FEE')) return 'PAYMENT';
  if (a.includes('LOGIN')) return 'LOGIN';
  if (a.includes('CREATE') || a.includes('ADD')) return 'CREATE';
  return action.slice(0, 8).toUpperCase() || 'ACTION';
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function EmptyBlock({ icon: Icon, text }: { icon?: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {Icon && <Icon className="mb-2 h-8 w-8 text-muted-foreground/40" />}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

type Props = { onNavigate?: (module: string) => void };

const AdministratorDashboard = ({ onNavigate }: Props) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { students, teachers, classes } = useData();
  const { currentTerm, currentYear, isLoading: termLoading, refresh: refreshTerm } = useActiveTerm();

  const { data: overview, isLoading: overviewLoading, refetch: refetchOverview } = useAdminOverview();
  const { data: outstandingSummary } = useOutstandingFeesSummary();
  const { data: attendanceRows = [], isLoading: attendanceLoading, refetch: refetchAttendance } = useAttendanceSummary();
  const { data: performance, isLoading: performanceLoading, refetch: refetchPerformance } = useAcademicPerformance();
  const { data: auditLogs = [], isLoading: auditLoading, refetch: refetchAudit } = useRecentAuditLogs(8);

  const [refreshing, setRefreshing] = useState(false);
  const [sideDataKey, setSideDataKey] = useState(0);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [birthdays, setBirthdays] = useState<
    Array<{ id: number; fullName: string; type: string; dateOfBirth: string; className?: string | null; dayLabel?: string }>
  >([]);
  const [birthdaysLoading, setBirthdaysLoading] = useState(true);
  const [monthBirthdayCount, setMonthBirthdayCount] = useState(0);
  const [events, setEvents] = useState<Array<{ id: number; title: string; event_date: string; color?: string }>>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [todoLoginBlink, setTodoLoginBlink] = useState(false);

  const today = todayIso();
  const { data: dailyClasses = [], refetch: refetchDailyClasses } = useQuery({
    queryKey: ['daily-fees', 'classes'],
    queryFn: () => apiService.get<Array<{ id: number }>>('/daily-fees/classes').catch(() => []),
    staleTime: 60_000,
  });
  const hasDailyFees = dailyClasses.length > 0;

  const { data: dailyToday, isLoading: dailyTodayLoading, refetch: refetchDailyToday } = useQuery({
    queryKey: ['daily-fees', 'today', today],
    queryFn: () =>
      apiService
        .get<{ totalCollected?: number; total?: number }>(`/daily-fees/payments?startDate=${today}&endDate=${today}&limit=1`)
        .catch(() => ({ totalCollected: 0, total: 0 })),
    enabled: hasDailyFees,
    staleTime: 30_000,
  });

  const loadTodos = useCallback(async () => {
    setTodosLoading(true);
    try {
      const list = await apiService.get<PersonalTodo[]>('/todos');
      setTodos(Array.isArray(list) ? list : []);
    } catch {
      setTodos([]);
    } finally {
      setTodosLoading(false);
    }
  }, []);

  const loadBirthdays = useCallback(async () => {
    setBirthdaysLoading(true);
    try {
      const [todayRes, upcomingRes, monthRes] = await Promise.all([
        apiService.get<Array<{ id: number; fullName: string; type: string; dateOfBirth: string; className?: string }>>('/birthdays/today').catch(() => []),
        apiService.get<Array<{ date: string; dayLabel: string; people: Array<{ id: number; fullName: string; type: string; dateOfBirth: string; className?: string }> }>>('/birthdays/upcoming?days=60').catch(() => []),
        apiService.get<{ groups?: Array<{ people: unknown[] }> }>('/birthdays/upcoming?scope=months').catch(() => null),
      ]);
      const todayList = Array.isArray(todayRes) ? todayRes : [];
      const flat: typeof birthdays = todayList.map((p) => ({ ...p, dayLabel: 'Today' }));
      const upcoming = Array.isArray(upcomingRes) ? upcomingRes : [];
      for (const group of upcoming.slice(0, 5)) {
        for (const p of group.people || []) {
          if (flat.length >= 5) break;
          if (flat.some((x) => x.id === p.id && x.type === p.type)) continue;
          flat.push({ ...p, dayLabel: group.dayLabel });
        }
      }
      setBirthdays(flat.slice(0, 5));
      setMonthBirthdayCount(monthRes?.groups?.reduce((s, g) => s + (g.people?.length ?? 0), 0) ?? 0);
    } catch {
      setBirthdays([]);
    } finally {
      setBirthdaysLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 6);
      const rows = await apiService.get<Array<{ id: number; title: string; event_date: string; color?: string }>>(
        `/events?startDate=${today}&endDate=${endDate.toISOString().slice(0, 10)}`
      );
      setEvents(Array.isArray(rows) ? rows : []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, [today]);

  useEffect(() => { void loadTodos(); }, [loadTodos, sideDataKey]);
  useEffect(() => { void loadBirthdays(); }, [loadBirthdays, sideDataKey]);
  useEffect(() => { void loadEvents(); }, [loadEvents, sideDataKey]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchOverview(),
        refetchAttendance(),
        refetchPerformance(),
        refetchAudit(),
        refreshTerm(),
        refetchDailyClasses(),
        hasDailyFees ? refetchDailyToday() : Promise.resolve(),
        queryClient.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      setSideDataKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, [refetchOverview, refetchAttendance, refetchPerformance, refetchAudit, refreshTerm, refetchDailyClasses, refetchDailyToday, hasDailyFees, queryClient]);

  const localActiveStudentCount = useMemo(() => students.filter(shouldTrackStudentFees).length, [students]);
  const useLocalFallback = !overviewLoading && !overview;

  const totalStudents = overview?.students.total ?? (useLocalFallback ? localActiveStudentCount : 0);
  const maleStudents = overview?.students.male ?? 0;
  const femaleStudents = overview?.students.female ?? 0;
  const totalTeachers = overview?.teachers.total ?? (useLocalFallback ? teachers.length : 0);
  const totalOtherStaff = overview?.otherStaff?.total ?? 0;
  const totalStaff = totalTeachers + totalOtherStaff;
  const maleStaff =
    overview?.maleStaff ??
    (overview?.teachers.male ?? 0) + (overview?.otherStaff?.male ?? 0);
  const femaleStaff =
    overview?.femaleStaff ??
    (overview?.teachers.female ?? 0) + (overview?.otherStaff?.female ?? 0);
  const activeClasses = overview?.classes.total ?? (useLocalFallback ? classes.filter((c) => c.className?.trim()).length : 0);
  const feeCountsBase = overview?.feeStatus ?? { paid: 0, owing: 0, noFee: 0, credit: 0, totalOwing: 0 };
  // Same truth as Fees → Outstanding Fees (and finance/home dashboards).
  const totalOwing = outstandingSummary?.totalOutstanding ?? feeCountsBase.totalOwing ?? 0;
  const owingCount = outstandingSummary?.studentsOwing ?? feeCountsBase.owing ?? 0;
  const feeCounts = {
    ...feeCountsBase,
    owing: owingCount,
    totalOwing,
  };
  const paymentTrend = overview?.paymentTrend ?? [];
  const enrollmentByClass = overview?.enrollmentByClass ?? [];

  const feeStudentsTotal = feeCounts.paid + feeCounts.owing + feeCounts.noFee + feeCounts.credit;
  const collectionPct = feeCounts.paid + feeCounts.owing > 0 ? Math.round((feeCounts.paid / (feeCounts.paid + feeCounts.owing)) * 100) : 0;

  const monthCollected = useMemo(() => {
    const ym = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    return paymentTrend.filter((r) => r.date.startsWith(ym)).reduce((s, r) => s + r.total, 0);
  }, [paymentTrend]);

  /** Same shape & chart as Daily Fee Payment Timeline */
  const timelineData = useMemo(() => {
    let cumulative = 0;
    return paymentTrend
      .filter((row) => row.total > 0)
      .map((row) => {
        cumulative += row.total;
        const hasBoth = row.dailyFees > 0 && row.termFees > 0;
        const breakdown = hasBoth
          ? `Term ${formatGhs(row.termFees)} + Daily ${formatGhs(row.dailyFees)}`
          : row.dailyFees > 0
            ? 'Daily fees'
            : 'Term fees';
        return {
          date: row.date,
          label: formatDisplayDate(row.date),
          amount: row.total,
          termFees: row.termFees,
          dailyFees: row.dailyFees,
          breakdown,
          cumulative,
        };
      });
  }, [paymentTrend]);

  const pieData = useMemo(
    () =>
      [
        { name: 'Paid', value: feeCounts.paid, color: CHART_GREEN },
        { name: 'Outstanding', value: feeCounts.owing, color: '#ef4444' },
        { name: 'No fee set', value: feeCounts.noFee, color: '#f59e0b' },
        { name: 'Credit', value: feeCounts.credit, color: '#6366f1' },
      ].filter((d) => d.value > 0),
    [feeCounts]
  );

  const attendanceToday = useMemo(() => {
    const row = attendanceRows.find((r) => String(r.date).slice(0, 10) === today);
    if (!row || row.total === 0) return null;
    return Math.round((row.present / row.total) * 100);
  }, [attendanceRows, today]);

  const attendanceSpark = useMemo(
    () =>
      [...attendanceRows]
        .slice(0, 7)
        .reverse()
        .map((r) => ({ pct: r.total > 0 ? Math.round((r.present / r.total) * 100) : 0 })),
    [attendanceRows]
  );

  const todayPendingCount = useMemo(() => countTodayPendingTodos(todos), [todos]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startBlink = () => {
      if (todayPendingCount <= 0) return;
      setTodoLoginBlink(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setTodoLoginBlink(false), 4000);
    };
    window.addEventListener('userLogin', startBlink);
    return () => {
      window.removeEventListener('userLogin', startBlink);
      if (timer) clearTimeout(timer);
    };
  }, [todayPendingCount]);

  const displayName = user?.fullName || user?.username || 'Admin';
  const dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const calendarDays = useMemo(() => {
    const days: Array<{ key: string; name: string; num: number; isToday: boolean; events: typeof events }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push({
        key,
        name: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        num: d.getDate(),
        isToday: i === 0,
        events: events.filter((e) => String(e.event_date).slice(0, 10) === key),
      });
    }
    return days;
  }, [events]);

  const toggleTodo = useCallback(async (todo: PersonalTodo) => {
    const next = !todo.is_completed;
    setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_completed: next } : t)));
    try {
      await apiService.put(`/todos/${todo.id}`, { is_completed: next });
    } catch {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? { ...t, is_completed: !next } : t)));
    }
  }, []);

  const nav = (module: string) => onNavigate?.(module);
  const dailyCollectedToday = Number(dailyToday?.totalCollected ?? 0);
  const dailyPaymentsToday = Number(dailyToday?.total ?? 0);

  const kpiItems = [
    { label: 'Active Students', value: totalStudents, sub: `${maleStudents}M · ${femaleStudents}F`, icon: Users, border: 'border-l-emerald-600 dark:border-l-emerald-500', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', loading: overviewLoading },
    { label: 'Total Staff', value: totalStaff, sub: `${totalTeachers} teachers · ${totalOtherStaff} other`, sub2: `${maleStaff}M · ${femaleStaff}F`, icon: Briefcase, border: 'border-l-indigo-600 dark:border-l-indigo-400', iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', loading: overviewLoading },
    { label: 'Classes', value: activeClasses, sub: 'Academic setup', icon: GraduationCap, border: 'border-l-amber-500', iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', loading: overviewLoading },
    { label: 'Term Fee Health', value: formatGhsCompact(totalOwing), valueTitle: formatGhs(totalOwing), sub: `${feeCounts.owing} owing`, icon: DollarSign, border: 'border-l-emerald-600 dark:border-l-emerald-500', iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', loading: overviewLoading, progress: collectionPct, isCurrency: true },
    hasDailyFees
      ? { label: 'Daily Collections Today', value: formatGhsCompact(dailyCollectedToday), valueTitle: formatGhs(dailyCollectedToday), sub: `${dailyPaymentsToday} payments today`, icon: CalendarCheck, border: 'border-l-violet-600 dark:border-l-violet-400', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', loading: dailyTodayLoading, isCurrency: true }
      : { label: 'Attendance Rate', value: attendanceToday != null ? `${attendanceToday}%` : '—', sub: attendanceToday != null ? "Today's attendance" : 'Not marked yet', icon: CalendarCheck, border: 'border-l-violet-600 dark:border-l-violet-400', iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400', loading: attendanceLoading },
  ];

  return (
    <div className="min-h-full bg-[#FAFAFA] dark:bg-background">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
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
                  School Active
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
                className="h-9 gap-1.5 rounded-lg"
                onClick={() => void handleRefresh()}
                disabled={refreshing}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
              <Button size="sm" className="h-9 gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => nav('fees')}>
                <Plus className="h-4 w-4" /> Record Payment
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg" onClick={() => nav('students')}>
                <Plus className="h-4 w-4" /> Add Student
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg" onClick={() => nav('push-notifications')}>
                <Megaphone className="h-4 w-4" /> Announcement
              </Button>
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible">
          {kpiItems.map((k) => (
            <div
              key={k.label}
              className={cn(surfaceCard, 'min-w-[200px] flex-shrink-0 snap-start border-l-4 p-4 hover:-translate-y-0.5 md:min-w-0', k.border)}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{k.label}</p>
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', k.iconBg)}>
                  <k.icon className="h-4 w-4" />
                </div>
              </div>
              {k.loading ? (
                <Skeleton className="mt-2 h-7 w-24" />
              ) : (
                <p
              className={cn(
                    'mt-1.5 font-bold tabular-nums text-foreground',
                    'isCurrency' in k && k.isCurrency
                      ? 'text-base leading-tight sm:text-lg'
                      : 'text-2xl leading-none md:text-[26px]'
                  )}
                  title={'valueTitle' in k && k.valueTitle ? String(k.valueTitle) : undefined}
                >
                  {k.value}
                </p>
              )}
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{k.loading ? '…' : k.sub}</p>
              {'sub2' in k && k.sub2 ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{k.loading ? '…' : k.sub2}</p>
              ) : null}
              {'progress' in k && k.progress != null && !k.loading && (
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-emerald-600 transition-all duration-700 dark:bg-emerald-500" style={{ width: `${k.progress}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* Collections Timeline — identical to Daily Fee Payment Timeline */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Collections Timeline — Last 30 Days
                  </CardTitle>
                  {!overviewLoading && monthCollected > 0 && (
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatGhs(monthCollected)} this month
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {overviewLoading ? (
                  <Skeleton className="h-72 w-full rounded-lg" />
                ) : timelineData.length === 0 ? (
                  <EmptyBlock icon={TrendingUp} text="No payments recorded yet" />
                ) : (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="adminCumFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.35} />
                            <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={48} />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: number) => [formatGhs(value), 'Cumulative']}
                          labelFormatter={(_, payload) => {
                            const row = payload?.[0]?.payload as { label?: string; amount?: number; breakdown?: string } | undefined;
                            if (!row) return '';
                            return `${row.label} · ${formatGhs(row.amount ?? 0)} · ${row.breakdown ?? ''}`;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="cumulative"
                          stroke={CHART_GREEN}
                          strokeWidth={2}
                          fill="url(#adminCumFill)"
                          dot={{ r: 4, fill: CHART_GREEN, strokeWidth: 0 }}
                          animationDuration={700}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Fee + enrollment */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Fee Status · {currentTerm}</CardTitle>
                  <p className="text-xs text-muted-foreground">Term-fee students only</p>
            </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Skeleton className="h-[220px]" />
              ) : pieData.length === 0 ? (
                    <EmptyBlock text="No term-fee data yet" />
              ) : (
                    <>
                      <div className="relative h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                            <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={3} dataKey="value" stroke="hsl(var(--background))" strokeWidth={2}>
                              {pieData.map((e) => <Cell key={e.name} fill={e.color} />)}
                              <Label value={feeStudentsTotal} position="center" className="fill-foreground text-xl font-bold" />
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v} students`} contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                        <p className="pointer-events-none absolute inset-x-0 top-[58%] text-center text-[10px] text-muted-foreground">students</p>
                      </div>
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        <div className="flex justify-between"><span className="text-red-500">● Outstanding</span><span>{feeCounts.owing} · {formatGhs(totalOwing)}</span></div>
                        <div className="flex justify-between"><span className="text-amber-500">● No fee / Credit</span><span>{feeCounts.noFee + feeCounts.credit} students</span></div>
                        <div className="flex justify-between"><span className="text-emerald-500">● Paid</span><span>{feeCounts.paid} students</span></div>
                </div>
                    </>
              )}
            </CardContent>
          </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Enrollment by Class</CardTitle>
                  <p className="text-xs text-muted-foreground">Active students per class</p>
            </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <Skeleton className="h-[220px]" />
              ) : enrollmentByClass.length === 0 ? (
                    <EmptyBlock text="No class assignments yet" />
              ) : (
                    <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={enrollmentByClass.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} students`, 'Count']} />
                          <Bar dataKey="count" fill={CHART_GREEN} radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

            {/* Activity */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                <p className="text-xs text-muted-foreground">Latest actions across the school</p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {auditLoading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="mx-6 my-3 h-11 rounded-lg" />)
                  ) : auditLogs.length === 0 ? (
                    <EmptyBlock text="No recent activity" />
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log.id} className="flex items-center gap-3 px-6 py-3 transition-colors hover:bg-muted/40">
                        <span className={cn('shrink-0 rounded px-2 py-0.5 text-[10px] font-bold', actionBadgeClass(log.action))}>
                          {actionLabel(log.action)}
                        </span>
                        <p className="min-w-0 flex-1 truncate text-sm text-foreground">{log.summary || log.action}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{log.user_full_name || log.username || 'System'}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="border-t border-border px-6 py-3">
                  <button type="button" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400" onClick={() => nav('audit')}>
                    View all activity <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <StaffAttendanceClockCard
              variant="sidebar"
              onOpenHistory={onNavigate ? () => onNavigate('my-staff-attendance') : undefined}
            />

            <Card className={cn(surfaceCard, 'p-5')}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Attendance Rate</p>
              {attendanceLoading ? (
                <Skeleton className="mt-2 h-10 w-24" />
              ) : (
                <p className={cn('mt-1 text-3xl font-bold tabular-nums', attendanceToday == null ? 'text-muted-foreground' : attendanceToday >= 80 ? 'text-emerald-600 dark:text-emerald-400' : attendanceToday >= 50 ? 'text-amber-600' : 'text-red-600')}>
                  {attendanceToday != null ? `${attendanceToday}%` : '—'}
                </p>
              )}
              <p className="mt-0.5 text-xs text-muted-foreground">Today&apos;s attendance</p>
              <div className="mt-3 flex h-8 items-end gap-1">
                {attendanceSpark.length === 0 ? (
                  <div className="h-2 w-full rounded bg-muted" />
                ) : (
                  attendanceSpark.map((d, i) => (
                    <div
                      key={i}
                      className={cn('flex-1 rounded-sm', d.pct >= 80 ? 'bg-emerald-500' : d.pct >= 50 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ height: `${Math.max(4, (d.pct / 100) * 32)}px`, opacity: 0.65 + i * 0.05 }}
                    />
                  ))
                )}
              </div>
            </Card>

            <Card className={cn(surfaceCard, 'border-l-4 border-l-red-500 p-5')}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold text-foreground">Fees Due</h3>
              </div>
              {overviewLoading ? (
                <Skeleton className="mt-3 h-12" />
              ) : feeCounts.owing === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">All term-fee students are paid up.</p>
            ) : (
              <>
                  <p className="mt-2 text-xs text-foreground"><strong>{feeCounts.owing}</strong> students with outstanding balances</p>
                  <p className="mt-1 text-lg font-bold tabular-nums leading-tight text-red-600 dark:text-red-400" title={formatGhs(totalOwing)}>
                    {formatGhsCompact(totalOwing)}
                  </p>
                  <Button size="sm" variant="outline" className="mt-3 h-8 rounded-lg text-xs" onClick={() => nav('fees')}>View All</Button>
                </>
              )}
            </Card>

            <Card className={cn(surfaceCard, 'p-5')}>
              <h3 className="text-sm font-semibold text-foreground">Academic Performance</h3>
              {performanceLoading ? (
                <Skeleton className="mt-3 h-10 w-20" />
              ) : !performance?.schoolAverage ? (
                <p className="mt-2 text-sm text-muted-foreground">No graded assessments yet</p>
              ) : (
                <>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{Number(performance.schoolAverage).toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground">Based on recent assessments</p>
                </>
              )}
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Cake className="h-4 w-4 text-amber-500" /> Upcoming Birthdays
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {birthdaysLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mx-5 my-3 h-12" />)
                  ) : birthdays.length === 0 ? (
                    <EmptyBlock icon={Cake} text="No upcoming birthdays" />
                  ) : (
                    birthdays.map((p) => {
                      const isToday = p.dayLabel === 'Today';
                      return (
                        <div key={`${p.type}-${p.id}`} className={cn('flex items-center gap-3 px-5 py-3', isToday && 'bg-amber-500/10 dark:bg-amber-500/15')}>
                          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white', isToday ? 'bg-gradient-to-br from-amber-400 to-orange-500' : 'bg-gradient-to-br from-indigo-500 to-indigo-400')}>
                            {isToday ? <Cake className="h-4 w-4" /> : initials(p.fullName)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{p.fullName}</p>
                            <p className="text-xs text-muted-foreground">{isToday ? 'Today' : p.dayLabel} · {p.type === 'student' ? 'Student' : 'Staff'}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                              </div>
                {!birthdaysLoading && monthBirthdayCount > 0 && (
                  <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">This month: {monthBirthdayCount} birthdays</p>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <ClipboardList className="h-4 w-4" /> My To-Dos
                </CardTitle>
                {!todosLoading && todayPendingCount > 0 && (
                  <Badge
                    className={cn(
                      'border-0 bg-amber-500 text-[10px] text-white hover:bg-amber-500',
                      todoLoginBlink && 'animate-pulse ring-2 ring-amber-300 ring-offset-1'
                    )}
                  >
                    {todayPendingCount} today
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {todosLoading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="mx-5 my-3 h-10" />)
                  ) : todos.length === 0 ? (
                    <EmptyBlock text="No tasks yet" />
                  ) : (
                    todos.slice(0, 5).map((todo) => (
                      <label key={todo.id} className="flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-muted/40">
                        <Checkbox checked={todo.is_completed} onCheckedChange={() => void toggleTodo(todo)} className="mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-sm text-foreground', todo.is_completed && 'text-muted-foreground line-through')}>{todo.content}</p>
                          {todo.reminder_at && (
                            <p className="text-[11px] text-muted-foreground">Due {new Date(todo.reminder_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
                <div className="border-t border-border px-5 py-3">
                  <button type="button" className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400" onClick={() => window.dispatchEvent(new Event('personal-todos-open'))}>
                    <Plus className="h-3.5 w-3.5" /> Add task
                  </button>
                </div>
              </CardContent>
            </Card>
                        </div>
                      </div>

        {/* Calendar strip */}
        <Card className={cn(surfaceCard, 'px-5 py-4')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 justify-between gap-1 sm:justify-start sm:gap-4">
              {eventsLoading ? (
                Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-12 rounded-lg" />)
              ) : (
                calendarDays.map((day) => (
                  <div key={day.key} className="flex flex-col items-center gap-1 px-1">
                    <span className="text-[10px] font-medium uppercase text-muted-foreground">{day.name}</span>
                    <span className={cn('flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold', day.isToday ? 'bg-emerald-600 text-white' : 'text-foreground')}>
                      {day.num}
                    </span>
                    <div className="flex h-2 gap-0.5">
                      {day.events.slice(0, 3).map((ev) => (
                        <span key={ev.id} className="h-1.5 w-1.5 rounded-full bg-indigo-500" style={{ backgroundColor: ev.color || undefined }} title={ev.title} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
            <button type="button" className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400" onClick={() => nav('calendar')}>
              View full calendar <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </Card>

        <p className="text-center text-[10px] text-muted-foreground">Term fee figures exclude daily-fee classes</p>
      </div>
    </div>
  );
};

export default AdministratorDashboard;
