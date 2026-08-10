import React, { useEffect, useMemo, useState } from 'react';
import {
  BedDouble,
  Users,
  UserCheck,
  AlertCircle,
  Stethoscope,
  ClipboardList,
  ChevronRight,
  RefreshCw,
  Plus,
  ArrowRightLeft,
  Building2,
  Printer,
  UtensilsCrossed,
  Flag,
  DoorOpen,
  HeartPulse,
  DollarSign,
  Calendar,
  CircleCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { boardingService, type BoardingOverviewStats } from '@/services/boardingService';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import {
  boardingSurfaceCard,
} from '@/utils/boardingUi';
import BoardingDormLayoutGrid from './BoardingDormLayoutGrid';
import BoardingRolloverModal from './BoardingRolloverModal';

interface BoardingOverviewProps {
  onNavigate?: (module: string) => void;
}

function roleLabel(role?: string) {
  if (role === 'matron') return 'Matron';
  if (role === 'house-master') return 'House Master';
  return 'Boarding';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export const BoardingOverview: React.FC<BoardingOverviewProps> = ({ onNavigate }) => {
  const { user, actsAsPrimaryAdmin, hasAccess } = useAuth();
  const { currentTerm, currentYear, isLoading: termLoading } = useActiveTerm();
  const isAdmin = actsAsPrimaryAdmin || user?.role === 'administrator' || user?.role === 'super-admin';
  const isBoardingStaff = user?.role === 'matron' || user?.role === 'house-master';
  const staffTitle = roleLabel(user?.role);
  const displayName = user?.fullName || user?.username || staffTitle;
  const dateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const [stats, setStats] = useState<BoardingOverviewStats | null>(null);
  const [dormLayout, setDormLayout] = useState<BoardingOverviewStats['dorm_layout'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await boardingService.getOverview();
      setStats(data);
    } catch (err) {
      console.error('Failed to load boarding overview:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const loadDormLayout = async () => {
    setLayoutLoading(true);
    try {
      const layout = await boardingService.getDormLayout();
      setDormLayout(layout);
    } catch (err) {
      console.error('Failed to load dorm layout:', err);
      setDormLayout(null);
    } finally {
      setLayoutLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
      await loadDormLayout();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!loading && stats) void loadDormLayout();
  }, [loading, stats?.total_boarders]);

  const occupancyPct =
    stats && stats.total_beds > 0
      ? Math.round((stats.occupied_beds / stats.total_beds) * 100)
      : 0;

  const nav = (module: string) => onNavigate?.(module);

  const moduleLinks = useMemo(() => {
    const links: Array<{
      id: string;
      label: string;
      desc: string;
      icon: React.ElementType;
      border: string;
      iconBg: string;
      badge?: string | number;
      urgent?: boolean;
    }> = [];

    if (hasAccess('boarding-rollcall')) {
      links.push({
        id: 'boarding-rollcall',
        label: "Today's roll call",
        desc: stats?.todays_roll_call_done ? 'Completed for today' : 'Mark boarder attendance',
        icon: ClipboardList,
        border: stats?.todays_roll_call_done ? 'border-l-emerald-600 dark:border-l-emerald-500' : 'border-l-amber-500',
        iconBg: stats?.todays_roll_call_done
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
        badge: stats?.todays_roll_call_done ? 'Done' : 'Pending',
        urgent: !stats?.todays_roll_call_done,
      });
    }
    if (hasAccess('boarding-exeats')) {
      links.push({
        id: 'boarding-exeats',
        label: 'Exeats & weekends',
        desc: `${stats?.pending_exeats ?? 0} pending · ${stats?.overdue_exeats ?? 0} overdue`,
        icon: DoorOpen,
        border: (stats?.overdue_exeats ?? 0) > 0 ? 'border-l-red-500' : 'border-l-sky-600 dark:border-l-sky-400',
        iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
        badge: stats?.pending_exeats ?? 0,
        urgent: (stats?.overdue_exeats ?? 0) > 0,
      });
    }
    if (hasAccess('boarding-sickbay')) {
      links.push({
        id: 'boarding-sickbay',
        label: 'Sick bay',
        desc: 'Active cases and recovery tracking',
        icon: Stethoscope,
        border: 'border-l-violet-600 dark:border-l-violet-400',
        iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
        badge: stats?.sick_bay_active_count ?? 0,
      });
    }
    if (hasAccess('boarding-boarders')) {
      links.push({
        id: 'boarding-boarders',
        label: isBoardingStaff ? 'View boarders' : 'Manage boarders',
        desc: `${stats?.boys_count ?? 0} boys · ${stats?.girls_count ?? 0} girls enrolled`,
        icon: Users,
        border: 'border-l-emerald-600 dark:border-l-emerald-500',
        iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        badge: stats?.total_boarders ?? 0,
      });
    }
    if (hasAccess('boarding-print')) {
      links.push({
        id: 'boarding-print',
        label: 'Print bed lists',
        desc: 'Male & female house lists by room',
        icon: Printer,
        border: 'border-l-teal-600 dark:border-l-teal-400',
        iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
      });
    }
    if (hasAccess('boarding-feeding')) {
      links.push({
        id: 'boarding-feeding',
        label: 'Meal menu',
        desc: 'Weekly breakfast, lunch & dinner',
        icon: UtensilsCrossed,
        border: 'border-l-orange-500',
        iconBg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
      });
    }
    if (hasAccess('boarding-complaints')) {
      links.push({
        id: 'boarding-complaints',
        label: 'Complaints',
        desc: 'File or track boarding concerns',
        icon: Flag,
        border: 'border-l-rose-500',
        iconBg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        badge: stats?.open_complaints ?? 0,
      });
    }
    if (hasAccess('boarding-dormitories') && isAdmin) {
      links.push({
        id: 'boarding-dormitories',
        label: 'Dormitories & rooms',
        desc: 'Configure beds and room layout',
        icon: Building2,
        border: 'border-l-indigo-600 dark:border-l-indigo-400',
        iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      });
    }
    if (hasAccess('boarding-finance')) {
      links.push({
        id: 'boarding-finance',
        label: 'Finance overview',
        desc: 'Boarding fees and balances',
        icon: DollarSign,
        border: 'border-l-amber-500',
        iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      });
    }
    return links;
  }, [hasAccess, isBoardingStaff, isAdmin, stats]);

  const kpiItems = useMemo(
    () => [
      {
        label: 'Total boarders',
        value: stats?.total_boarders ?? 0,
        sub: `${stats?.boys_count ?? 0} boys · ${stats?.girls_count ?? 0} girls`,
        icon: Users,
        border: 'border-l-emerald-600 dark:border-l-emerald-500',
        iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      },
      {
        label: 'Bed occupancy',
        value: `${stats?.occupied_beds ?? 0}/${stats?.total_beds ?? 0}`,
        sub: `${occupancyPct}% filled · ${stats?.vacant_beds ?? 0} vacant`,
        icon: BedDouble,
        border: 'border-l-sky-600 dark:border-l-sky-400',
        iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
        progress: occupancyPct,
      },
      {
        label: 'Pending exeats',
        value: stats?.pending_exeats ?? 0,
        sub: `${stats?.overdue_exeats ?? 0} overdue returns`,
        icon: AlertCircle,
        border: (stats?.overdue_exeats ?? 0) > 0 ? 'border-l-red-500' : 'border-l-amber-500',
        iconBg: (stats?.overdue_exeats ?? 0) > 0
          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      },
      {
        label: 'Sick bay active',
        value: stats?.sick_bay_active_count ?? 0,
        sub: 'Cases currently resting or sent home',
        icon: Stethoscope,
        border: 'border-l-violet-600 dark:border-l-violet-400',
        iconBg: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      },
      {
        label: "Today's roll call",
        value: stats?.todays_roll_call_done ? 'Done' : 'Pending',
        sub: stats?.todays_roll_call_done ? 'Attendance marked for today' : 'Roll call not completed yet',
        icon: ClipboardList,
        border: stats?.todays_roll_call_done ? 'border-l-emerald-600 dark:border-l-emerald-500' : 'border-l-amber-500',
        iconBg: stats?.todays_roll_call_done
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      },
    ],
    [stats, occupancyPct]
  );

  if (loading) {
    return (
      <div className="min-h-full bg-[#FAFAFA] dark:bg-background">
        <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6">
          <Skeleton className="h-36 rounded-2xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#FAFAFA] dark:bg-background">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 md:p-6 animate-in fade-in duration-500">
        {/* Hero — admin dashboard feel */}
        <div className={cn(boardingSurfaceCard, 'border-l-4 border-l-emerald-600 p-5 dark:border-l-emerald-500 md:p-6')}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <HeartPulse className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {isBoardingStaff ? `${staffTitle} portal` : 'Boarding & wellness'}
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-[28px]">
                {greeting()}, {displayName.split(' ')[0]}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1.5 rounded-full px-3 py-1 font-normal">
                  <Calendar className="h-3 w-3" />
                  {termLoading
                    ? 'Loading term…'
                    : currentYear && currentTerm && !currentTerm.includes(currentYear)
                      ? `${currentTerm} · ${currentYear}`
                      : currentTerm || 'Active term'}
                </Badge>
                <Badge className="gap-1.5 rounded-full border-0 bg-emerald-600 px-3 py-1 font-normal text-white hover:bg-emerald-600">
                  <CircleCheck className="h-3 w-3" />
                  {stats?.total_boarders ?? 0} boarders tonight
                </Badge>
                {(stats?.overdue_exeats ?? 0) > 0 ? (
                  <Badge variant="outline" className="gap-1.5 rounded-full border-red-200 bg-red-50 px-3 py-1 font-normal text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
                    <AlertCircle className="h-3 w-3" />
                    {stats?.overdue_exeats} overdue exeat{(stats?.overdue_exeats ?? 0) === 1 ? '' : 's'}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
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
              {onNavigate && isAdmin ? (
                <>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg" onClick={() => setRolloverOpen(true)}>
                    <ArrowRightLeft className="h-4 w-4" />
                    Term rollover
                  </Button>
                  <Button size="sm" variant="outline" className="h-9 gap-1.5 rounded-lg" onClick={() => nav('boarding-dormitories')}>
                    <Building2 className="h-4 w-4" />
                    Dormitories
                  </Button>
                  <Button size="sm" className="h-9 gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => nav('boarding-boarders')}>
                    <Plus className="h-4 w-4" />
                    Manage boarders
                  </Button>
                </>
              ) : onNavigate && hasAccess('boarding-print') ? (
                <Button size="sm" className="h-9 gap-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => nav('boarding-print')}>
                  <Printer className="h-4 w-4" />
                  Print house lists
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        {/* KPI row — matches admin dashboard */}
        <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible">
          {kpiItems.map((k) => (
            <div
              key={k.label}
              className={cn(
                boardingSurfaceCard,
                'min-w-[200px] flex-shrink-0 snap-start border-l-4 p-4 hover:-translate-y-0.5 md:min-w-0',
                k.border
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">{k.label}</p>
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', k.iconBg)}>
                  <k.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="mt-1.5 text-2xl font-bold tabular-nums leading-none text-foreground md:text-[26px]">{k.value}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{k.sub}</p>
              {'progress' in k && k.progress != null ? (
                <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-all duration-700 dark:bg-emerald-500"
                    style={{ width: `${k.progress}%` }}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Main grid — admin two-column layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {/* Module shortcuts */}
            {onNavigate && moduleLinks.length > 0 ? (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Quick links</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 xl:grid-cols-3">
                  {moduleLinks.map((link) => (
                    <button
                      key={link.id}
                      type="button"
                      onClick={() => nav(link.id)}
                      className={cn(
                        boardingSurfaceCard,
                        'flex items-center gap-2.5 border-l-[3px] px-2.5 py-2 text-left hover:bg-muted/30',
                        link.border,
                        link.urgent && 'ring-1 ring-amber-400/40 dark:ring-amber-500/30'
                      )}
                    >
                      <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', link.iconBg)}>
                        <link.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-foreground truncate">{link.label}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{link.desc}</p>
                      </div>
                      {link.badge !== undefined ? (
                        <Badge variant="outline" className="h-5 shrink-0 rounded-md px-1.5 tabular-nums text-[10px]">
                          {link.badge}
                        </Badge>
                      ) : null}
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            ) : null}

            {/* Dorm layout */}
            {(dormLayout || layoutLoading) ? (
              <Card className="rounded-2xl shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold">Tonight&apos;s boarders by dorm</CardTitle>
                      <CardDescription className="text-xs">
                        Boys and girls columns — exeats and sick bay flagged on each boarder
                      </CardDescription>
                    </div>
                    {onNavigate && hasAccess('boarding-print') ? (
                      <Button type="button" variant="outline" size="sm" className="h-8 rounded-lg shrink-0" onClick={() => nav('boarding-print')}>
                        <Printer className="h-3.5 w-3.5 mr-1.5" />
                        Print list
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent>
                  {layoutLoading && !dormLayout ? (
                    <Skeleton className="h-48 rounded-xl" />
                  ) : dormLayout ? (
                    <BoardingDormLayoutGrid layout={dormLayout} />
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </div>

          {/* Right sidebar — admin-style status panels */}
          <div className="space-y-4">
            <Card className={cn(boardingSurfaceCard, 'p-5')}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bed occupancy</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{occupancyPct}%</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {stats?.occupied_beds ?? 0} of {stats?.total_beds ?? 0} beds filled
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-600 transition-all dark:bg-emerald-500" style={{ width: `${occupancyPct}%` }} />
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">{stats?.vacant_beds ?? 0} beds available</p>
            </Card>

            <Card className={cn(boardingSurfaceCard, 'border-l-4 border-l-emerald-600 p-5 dark:border-l-emerald-500')}>
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-semibold text-foreground">Gender split</h3>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/60 p-3 dark:border-blue-900/50 dark:bg-blue-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Boys</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{stats?.boys_count ?? 0}</p>
                </div>
                <div className="rounded-xl border border-rose-200/80 bg-rose-50/60 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">Girls</p>
                  <p className="text-2xl font-bold tabular-nums text-foreground mt-1">{stats?.girls_count ?? 0}</p>
                </div>
              </div>
            </Card>

            {(stats?.overdue_exeats ?? 0) > 0 ? (
              <Card className={cn(boardingSurfaceCard, 'border-l-4 border-l-red-500 p-5')}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-semibold text-foreground">Overdue returns</h3>
                </div>
                <p className="mt-2 text-xs text-foreground">
                  <strong>{stats?.overdue_exeats}</strong> boarder{(stats?.overdue_exeats ?? 0) === 1 ? '' : 's'} past expected return date
                </p>
                {onNavigate ? (
                  <Button size="sm" variant="outline" className="mt-3 h-8 rounded-lg text-xs" onClick={() => nav('boarding-exeats')}>
                    View exeats
                  </Button>
                ) : null}
              </Card>
            ) : null}

            {!stats?.todays_roll_call_done ? (
              <Card className={cn(boardingSurfaceCard, 'border-l-4 border-l-amber-500 p-5')}>
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-semibold text-foreground">Roll call pending</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Today&apos;s boarder roll call has not been completed yet.</p>
                {onNavigate ? (
                  <Button size="sm" className="mt-3 h-8 rounded-lg bg-emerald-600 text-xs text-white hover:bg-emerald-700" onClick={() => nav('boarding-rollcall')}>
                    Start roll call
                  </Button>
                ) : null}
              </Card>
            ) : (
              <Card className={cn(boardingSurfaceCard, 'p-5')}>
                <div className="flex items-center gap-2">
                  <CircleCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-sm font-semibold text-foreground">Roll call complete</h3>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Today&apos;s attendance has been marked.</p>
              </Card>
            )}

            {(stats?.sick_bay_active_count ?? 0) > 0 ? (
              <Card className={cn(boardingSurfaceCard, 'border-l-4 border-l-violet-600 p-5 dark:border-l-violet-400')}>
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  <h3 className="text-sm font-semibold text-foreground">Sick bay</h3>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-violet-600 dark:text-violet-400">{stats?.sick_bay_active_count}</p>
                <p className="text-xs text-muted-foreground">Active case{(stats?.sick_bay_active_count ?? 0) === 1 ? '' : 's'}</p>
                {onNavigate ? (
                  <Button size="sm" variant="outline" className="mt-3 h-8 rounded-lg text-xs" onClick={() => nav('boarding-sickbay')}>
                    Open sick bay
                  </Button>
                ) : null}
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      <BoardingRolloverModal
        open={rolloverOpen}
        onOpenChange={setRolloverOpen}
        boarderCount={stats?.total_boarders ?? 0}
        onComplete={() => void loadData()}
      />
    </div>
  );
};

export default BoardingOverview;
