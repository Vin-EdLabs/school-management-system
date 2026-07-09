import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiService } from '@/services/api';
import { cn } from '@/lib/utils';
import {
  Activity,
  BarChart3,
  Building2,
  GraduationCap,
  LogIn,
  Pencil,
  RefreshCw,
  TrendingUp,
  UserCog,
  Users,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DailyUsageRow = {
  date: string;
  total_events: number;
  logins: number;
  students: number;
  teachers_staff: number;
  grade_entries: number;
  attendance_marks: number;
  finance_txns: number;
  record_edits: number;
  active_tenants: number;
};

type HourlyUsageRow = {
  hour: number;
  count: number;
};

type UsageBreakdownItem = {
  eventType: string;
  label: string;
  count: number;
};

type UsageSummary = {
  loginsToday: number;
  activeTenantsToday: number;
  eventsToday: number;
  topEventType: string;
  breakdown: UsageBreakdownItem[];
};

const CHART_COLORS = {
  total_events: '#047857',
  logins: '#10b981',
  students: '#0ea5e9',
  teachers_staff: '#6366f1',
  grade_entries: '#3b82f6',
  attendance_marks: '#f59e0b',
  finance_txns: '#8b5cf6',
  record_edits: '#ec4899',
  hourly: '#059669',
};

const ACTIVITY_LINES = [
  { key: 'total_events', name: 'Total Activity', color: CHART_COLORS.total_events, strokeWidth: 3 },
  { key: 'logins', name: 'Logins', color: CHART_COLORS.logins, strokeWidth: 2 },
  { key: 'students', name: 'Students', color: CHART_COLORS.students, strokeWidth: 2 },
  { key: 'teachers_staff', name: 'Teachers & Staff', color: CHART_COLORS.teachers_staff, strokeWidth: 2 },
  { key: 'grade_entries', name: 'Grades & Reports', color: CHART_COLORS.grade_entries, strokeWidth: 2 },
  { key: 'attendance_marks', name: 'Attendance', color: CHART_COLORS.attendance_marks, strokeWidth: 2 },
  { key: 'finance_txns', name: 'Finance', color: CHART_COLORS.finance_txns, strokeWidth: 2 },
  { key: 'record_edits', name: 'Edits & Other', color: CHART_COLORS.record_edits, strokeWidth: 2 },
] as const;

function formatShortDate(value: string) {
  const d = new Date(`${value}T12:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatHourLabel(hour: number) {
  const h = hour % 12 || 12;
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${h}${suffix}`;
}

const PlatformUsageModule: React.FC = () => {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<DailyUsageRow[]>([]);
  const [hourly, setHourly] = useState<HourlyUsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadUsage = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const [summaryRes, dailyRes, hourlyRes] = await Promise.all([
        apiService.get<UsageSummary>('/super-admin/usage/summary', { skipTenant: true }),
        apiService.get<DailyUsageRow[]>('/super-admin/usage/daily?days=30', { skipTenant: true }),
        apiService.get<HourlyUsageRow[]>('/super-admin/usage/hourly-today', { skipTenant: true }),
      ]);
      setSummary(summaryRes);
      setDaily(Array.isArray(dailyRes) ? dailyRes : []);
      setHourly(Array.isArray(hourlyRes) ? hourlyRes : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load usage stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadUsage(true);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadUsage]);

  const chartDaily = useMemo(
    () =>
      daily.map((row) => ({
        ...row,
        label: formatShortDate(row.date),
      })),
    [daily]
  );

  const chartHourly = useMemo(
    () =>
      hourly.map((row) => ({
        ...row,
        label: formatHourLabel(row.hour),
      })),
    [hourly]
  );

  const peakHour = useMemo(() => {
    if (!hourly.length) return null;
    const peak = hourly.reduce((best, row) => (row.count > best.count ? row : best), hourly[0]);
    return peak.count > 0 ? peak : null;
  }, [hourly]);

  const kpiCards = [
    {
      label: 'Logins Today',
      value: summary?.loginsToday ?? 0,
      icon: LogIn,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Active Tenants Today',
      value: summary?.activeTenantsToday ?? 0,
      icon: Building2,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Events Today',
      value: summary?.eventsToday ?? 0,
      icon: Zap,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Top Action',
      value: summary?.topEventType ?? '—',
      icon: TrendingUp,
      color: 'text-violet-500',
      bg: 'bg-violet-500/10',
      isText: true,
    },
  ];

  if (loading) {
    return <BrandedLoading label="Loading platform usage…" className="py-20" />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              <Activity className="h-3.5 w-3.5" />
              Platform Activity
            </div>
            <h3 className="font-outfit text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Usage Analytics
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Tracks logins, student and staff changes, grades, attendance, finance, and all record edits across every school.
              Usage spikes show on the total activity line and hourly chart.
            </p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-slate-400">
                Last updated {lastUpdated.toLocaleTimeString()}
                {peakHour ? ` · Peak hour today: ${formatHourLabel(peakHour.hour)} (${peakHour.count} events)` : ''}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => void loadUsage(true)}
            disabled={refreshing}
            className="h-11 rounded-xl border-slate-200 font-bold text-[10px] uppercase tracking-widest dark:border-slate-800"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
          <CardContent className="p-4 text-sm text-red-700 dark:text-red-300">{error}</CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((stat) => (
          <Card
            key={stat.label}
            className="border-slate-200 bg-white/50 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50"
          >
            <CardContent className="flex items-center justify-between p-5">
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                <p
                  className={cn(
                    'font-outfit font-black text-slate-900 dark:text-white',
                    stat.isText ? 'text-lg leading-tight' : 'text-3xl'
                  )}
                >
                  {stat.isText ? stat.value : Number(stat.value).toLocaleString()}
                </p>
              </div>
              <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl', stat.bg)}>
                <stat.icon className={cn('h-6 w-6', stat.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary?.breakdown && summary.breakdown.length > 0 && (
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-2">
              <Users className="h-5 w-5 text-emerald-600" />
              <h4 className="font-outfit text-lg font-black text-slate-900 dark:text-white">
                Today&apos;s Action Breakdown
              </h4>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {summary.breakdown.map((item) => (
                <div
                  key={item.eventType}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                  <p className="mt-1 font-outfit text-2xl font-black text-slate-900 dark:text-white">
                    {item.count.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
        <CardContent className="p-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <h4 className="font-outfit text-lg font-black text-slate-900 dark:text-white">
              Platform Activity (Last 30 Days)
            </h4>
          </div>
          <p className="mb-6 text-xs text-slate-500">
            Hover the chart to compare all action types. The bold line is total activity — spikes show busy periods.
          </p>
          <div className="h-[min(420px,55vh)] w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDaily} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid hsl(var(--border))',
                    background: 'hsl(var(--card))',
                    maxHeight: 280,
                    overflowY: 'auto',
                  }}
                />
                <Legend verticalAlign="top" height={48} wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                {ACTIVITY_LINES.map((line) => (
                  <Line
                    key={line.key}
                    type="monotone"
                    dataKey={line.key}
                    name={line.name}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    dot={false}
                    activeDot={{ r: line.key === 'total_events' ? 5 : 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50 lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-600" />
              <h4 className="font-outfit text-lg font-black text-slate-900 dark:text-white">
                Today&apos;s Activity by Hour
              </h4>
            </div>
            <div className="h-[min(320px,42vh)] w-full min-h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartHourly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={1}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, 'Events']}
                    labelFormatter={(label) => `Hour: ${label}`}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid hsl(var(--border))',
                      background: 'hsl(var(--card))',
                    }}
                  />
                  <Bar dataKey="count" name="All Actions" fill={CHART_COLORS.hourly} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
          <CardContent className="space-y-4 p-6">
            <h4 className="font-outfit text-sm font-black uppercase tracking-widest text-slate-500">
              What We Track
            </h4>
            {[
              { icon: Users, label: 'Students', detail: 'Add, edit, promote, enroll' },
              { icon: GraduationCap, label: 'Teachers & Staff', detail: 'Profiles, photos, roles' },
              { icon: Pencil, label: 'Record Edits', detail: 'Classes, settings, any update' },
              { icon: UserCog, label: 'Grades & Reports', detail: 'Scores, assessments, report cards' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.label}</p>
                  <p className="text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PlatformUsageModule;
