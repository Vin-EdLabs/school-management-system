import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock,
  Loader2,
  UserCheck,
  Users,
  UserX,
  AlertTriangle,
  RefreshCw,
  LogIn,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  formDialogContentClass,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  DetailField,
  dialogSectionClass,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  formatAttendanceDate,
  formatAttendanceTime,
  formatDuration,
  staffAttendanceService,
  type AttendanceSettings,
  type StaffAttendanceRecord,
  type TodayStaffRow,
} from '@/services/staffAttendanceService';

type Props = {
  readOnly?: boolean;
};

type DetailSource =
  | { kind: 'today'; row: TodayStaffRow }
  | { kind: 'history'; row: StaffAttendanceRecord };

function toLocalDatetimeValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isLikelyLate(settings: AttendanceSettings | null, localDatetime: string): boolean {
  if (!settings) return false;
  const checkIn = new Date(localDatetime);
  if (Number.isNaN(checkIn.getTime())) return false;
  const [sh, sm] = (settings.school_start_time || '07:30').split(':').map(Number);
  const threshold = Number(settings.late_threshold_minutes) || 0;
  const minutes = checkIn.getHours() * 60 + checkIn.getMinutes();
  const lateAfter = sh * 60 + (sm || 0) + threshold;
  return minutes > lateAfter;
}

function ReasonCell({
  reason,
  onView,
}: {
  reason: string | null | undefined;
  onView: () => void;
}) {
  if (!reason?.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  const long = reason.length > 36;
  return (
    <button
      type="button"
      onClick={onView}
      className="group max-w-[220px] text-left inline-flex items-start gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
      title="View full reason"
    >
      <span className={cn('text-sm text-amber-900 dark:text-amber-200', long && 'line-clamp-2')}>
        {reason}
      </span>
      <Eye className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600 opacity-70 group-hover:opacity-100" />
    </button>
  );
}

const StaffAttendanceDashboard: React.FC<Props> = ({ readOnly = false }) => {
  const [tab, setTab] = useState('today');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loadingToday, setLoadingToday] = useState(true);
  const [staff, setStaff] = useState<TodayStaffRow[]>([]);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, checked_out: 0, late: 0 });
  const [search, setSearch] = useState('');

  const [settings, setSettings] = useState<AttendanceSettings | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<StaffAttendanceRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [histStaffId, setHistStaffId] = useState('all');
  const [histFrom, setHistFrom] = useState('');
  const [histTo, setHistTo] = useState('');
  const [histLate, setHistLate] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStaff, setModalStaff] = useState<TodayStaffRow | null>(null);
  const [checkInTime, setCheckInTime] = useState(toLocalDatetimeValue());
  const [lateReason, setLateReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<DetailSource | null>(null);

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const data = await staffAttendanceService.getToday(roleFilter);
      setStaff(data.staff || []);
      setSummary(data.summary || { total: 0, present: 0, absent: 0, checked_out: 0, late: 0 });
    } catch (err: unknown) {
      toast({
        title: 'Could not load today overview',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setLoadingToday(false);
    }
  }, [roleFilter]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await staffAttendanceService.getHistory({
        staff_id: histStaffId !== 'all' ? Number(histStaffId) : undefined,
        date_from: histFrom || undefined,
        date_to: histTo || undefined,
        is_late: histLate === 'late' ? 'true' : histLate === 'on-time' ? 'false' : undefined,
        page: historyPage,
        limit: 20,
      });
      setHistory(data.items || []);
      setHistoryTotal(data.total || 0);
    } catch (err: unknown) {
      toast({
        title: 'Could not load history',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setHistoryLoading(false);
    }
  }, [histStaffId, histFrom, histTo, histLate, historyPage]);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useEffect(() => {
    if (tab === 'history') void loadHistory();
  }, [tab, loadHistory]);

  useEffect(() => {
    staffAttendanceService.getSettings().then(setSettings).catch(() => setSettings(null));
  }, []);

  const staffOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of staff) map.set(s.staff_id, s.name);
    for (const h of history) {
      if (h.staff_id && h.staff_name) map.set(h.staff_id, h.staff_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [staff, history]);

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.role.toLowerCase().includes(q) ||
        (s.late_reason || '').toLowerCase().includes(q)
    );
  }, [staff, search]);

  const openAdminCheckIn = (row: TodayStaffRow) => {
    setModalStaff(row);
    setCheckInTime(toLocalDatetimeValue());
    setLateReason('');
    setModalOpen(true);
  };

  const openDetail = (source: DetailSource) => {
    setDetail(source);
    setDetailOpen(true);
  };

  const submitAdminCheckIn = async () => {
    if (!modalStaff) return;
    const late = isLikelyLate(settings, checkInTime);
    if (late && !lateReason.trim()) {
      toast({ title: 'Late reason required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await staffAttendanceService.adminCheckIn(
        modalStaff.staff_id,
        new Date(checkInTime).toISOString(),
        lateReason.trim() || undefined
      );
      toast({ title: 'Staff checked in', description: modalStaff.name });
      setModalOpen(false);
      await loadToday();
    } catch (err: unknown) {
      const data = (err as { data?: { requiresReason?: boolean } })?.data;
      if (data?.requiresReason) {
        toast({ title: 'Late reason required', variant: 'destructive' });
        return;
      }
      toast({
        title: 'Check-in failed',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const statusBadge = (row: TodayStaffRow) => {
    if (row.status === 'present') {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">Present</Badge>;
    }
    if (row.status === 'checked_out') {
      return <Badge variant="secondary">Checked out</Badge>;
    }
    return <Badge variant="outline">Absent</Badge>;
  };

  const historyPages = Math.max(1, Math.ceil(historyTotal / 20));
  const showLateField = isLikelyLate(settings, checkInTime);

  const detailName =
    detail?.kind === 'today' ? detail.row.name : detail?.row.staff_name || 'Staff member';
  const detailRole =
    detail?.kind === 'today' ? detail.row.role : detail?.row.staff_role || '';
  const detailReason =
    detail?.kind === 'today' ? detail.row.late_reason : detail?.row.late_reason;
  const detailLate = detail?.kind === 'today' ? detail.row.is_late : detail?.row.is_late;
  const detailIn =
    detail?.kind === 'today' ? detail.row.check_in_time : detail?.row.check_in_time;
  const detailOut =
    detail?.kind === 'today' ? detail.row.check_out_time : detail?.row.check_out_time;
  const detailDate =
    detail?.kind === 'history' ? formatAttendanceDate(detail.row.date) : 'Today';

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5 animate-in fade-in duration-300">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
            <Clock className="h-3.5 w-3.5" />
            Staff monitoring
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Attendance</h1>
          <p className="text-sm text-white/75 max-w-xl">
            {readOnly
              ? 'School-wide staff clock-ins for today and past days (view only).'
              : 'Monitor who is present, late, or absent — and record manual check-ins when needed.'}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-xl bg-muted/80 p-1 h-auto">
          <TabsTrigger value="today" className="rounded-lg px-4 py-2">
            Today
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg px-4 py-2">
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: 'Total staff',
                value: summary.total,
                icon: Users,
                tone: 'border-slate-200 bg-slate-50 text-slate-800',
                iconTone: 'bg-slate-700 text-white',
              },
              {
                label: 'Present',
                value: summary.present + summary.checked_out,
                icon: UserCheck,
                tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
                iconTone: 'bg-emerald-600 text-white',
              },
              {
                label: 'Absent',
                value: summary.absent,
                icon: UserX,
                tone: 'border-rose-200 bg-rose-50 text-rose-800',
                iconTone: 'bg-rose-500 text-white',
              },
              {
                label: 'Late',
                value: summary.late,
                icon: AlertTriangle,
                tone: 'border-amber-200 bg-amber-50 text-amber-800',
                iconTone: 'bg-amber-500 text-white',
              },
            ].map((c) => (
              <Card key={c.label} className={cn('rounded-2xl shadow-sm border', c.tone)}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', c.iconTone)}>
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide opacity-80">{c.label}</p>
                    <p className="text-2xl font-bold tabular-nums leading-tight">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="relative flex-1">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search staff by name or role…"
                  className="h-10 rounded-xl"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-48 h-10 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="teacher">Teachers</SelectItem>
                  <SelectItem value="non-teaching">Non-teaching</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-xl"
                onClick={() => void loadToday()}
              >
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loadingToday && 'animate-spin')} />
                Refresh
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardHeader className="pb-2 border-b bg-muted/30">
              <CardTitle className="text-base">Today&apos;s board</CardTitle>
              <CardDescription>
                Late reasons are truncated — click the eye icon to read the full note.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {loadingToday ? (
                <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filteredStaff.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">No staff matched.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Check-in</th>
                      <th className="px-4 py-3 font-medium">Check-out</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Late reason</th>
                      {!readOnly && <th className="px-4 py-3 font-medium">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map((row) => (
                      <tr
                        key={row.staff_id}
                        className={cn(
                          'border-t border-border/80',
                          row.is_late && 'bg-amber-50/60 dark:bg-amber-950/15'
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 flex items-center justify-center text-xs font-bold shrink-0">
                              {row.name
                                .split(' ')
                                .map((p) => p[0])
                                .slice(0, 2)
                                .join('')
                                .toUpperCase()}
                            </div>
                            <button
                              type="button"
                              className="font-semibold text-left hover:underline"
                              onClick={() => openDetail({ kind: 'today', row })}
                            >
                              {row.name}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {row.role.replace(/-/g, ' ')}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatAttendanceTime(row.check_in_time)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatAttendanceTime(row.check_out_time)}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDuration(row.check_in_time, row.check_out_time, row.status === 'present')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 items-center">
                            {statusBadge(row)}
                            {row.is_late && (
                              <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                                Late
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <ReasonCell
                            reason={row.late_reason}
                            onView={() => openDetail({ kind: 'today', row })}
                          />
                        </td>
                        {!readOnly && (
                          <td className="px-4 py-3">
                            {row.status === 'absent' && (
                              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => openAdminCheckIn(row)}>
                                <LogIn className="h-3.5 w-3.5 mr-1.5" />
                                Check In
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>Narrow by staff, date range, or late status.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1 min-w-[180px]">
                <Label>Staff</Label>
                <Select
                  value={histStaffId}
                  onValueChange={(v) => {
                    setHistoryPage(1);
                    setHistStaffId(v);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="All staff" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All staff</SelectItem>
                    {staffOptions.map(([id, name]) => (
                      <SelectItem key={id} value={String(id)}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>From</Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={histFrom}
                  onChange={(e) => {
                    setHistoryPage(1);
                    setHistFrom(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input
                  type="date"
                  className="rounded-xl"
                  value={histTo}
                  onChange={(e) => {
                    setHistoryPage(1);
                    setHistTo(e.target.value);
                  }}
                />
              </div>
              <div className="space-y-1 min-w-[140px]">
                <Label>Status</Label>
                <Select
                  value={histLate}
                  onValueChange={(v) => {
                    setHistoryPage(1);
                    setHistLate(v);
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="on-time">On time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm overflow-hidden">
            <CardContent className="p-0 overflow-x-auto">
              {historyLoading ? (
                <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : history.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground text-sm">No records found.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Staff</th>
                      <th className="px-4 py-3 font-medium">Role</th>
                      <th className="px-4 py-3 font-medium">Check-in</th>
                      <th className="px-4 py-3 font-medium">Check-out</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          'border-t border-border/80',
                          row.is_late && 'bg-amber-50/60 dark:bg-amber-950/15'
                        )}
                      >
                        <td className="px-4 py-3">{formatAttendanceDate(row.date)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="font-semibold hover:underline text-left"
                            onClick={() => openDetail({ kind: 'history', row })}
                          >
                            {row.staff_name || '—'}
                          </button>
                        </td>
                        <td className="px-4 py-3 capitalize text-muted-foreground">
                          {(row.staff_role || '').replace(/-/g, ' ')}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{formatAttendanceTime(row.check_in_time)}</td>
                        <td className="px-4 py-3 tabular-nums">{formatAttendanceTime(row.check_out_time)}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {formatDuration(row.check_in_time, row.check_out_time)}
                        </td>
                        <td className="px-4 py-3">
                          {row.is_late ? (
                            <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                              Late
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">
                              On time
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <ReasonCell
                            reason={row.late_reason}
                            onView={() => openDetail({ kind: 'history', row })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {historyPages > 1 && (
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground">
                Page {historyPage} of {historyPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={historyPage <= 1}
                  onClick={() => setHistoryPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={historyPage >= historyPages}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Late reason / attendance detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className={detailDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Eye className="h-4 w-4" />
              </span>
              {detailName}
            </DialogTitle>
            <DialogDescription>
              {detailRole ? `${detailRole.replace(/-/g, ' ')} · ` : ''}
              {detailDate}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="grid grid-cols-2 gap-4">
              <DetailField label="Check-in">
                <span className="tabular-nums">{formatAttendanceTime(detailIn)}</span>
              </DetailField>
              <DetailField label="Check-out">
                <span className="tabular-nums">{formatAttendanceTime(detailOut)}</span>
              </DetailField>
            </div>
            <DetailField label="Duration">
              {formatDuration(
                detailIn || null,
                detailOut || null,
                detail?.kind === 'today' && detail.row.status === 'present'
              )}
            </DetailField>
            <div className={dialogSectionClass}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                  Late reason
                </p>
                {detailLate ? (
                  <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
                    Late
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-400 text-emerald-700 bg-emerald-50">
                    On time
                  </Badge>
                )}
              </div>
              {detailReason?.trim() ? (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{detailReason}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No late reason recorded.</p>
              )}
            </div>
          </DialogBody>
          <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
            <Button className="rounded-xl" onClick={() => setDetailOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!readOnly && (
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className={formDialogContentClass}>
            <DialogHeader className={detailDialogHeaderClass}>
              <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <LogIn className="h-4 w-4" />
                </span>
                Manual check-in
              </DialogTitle>
              <DialogDescription>
                Record attendance for {modalStaff?.name} without GPS validation.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
              <div className="space-y-1">
                <Label>Check-in time</Label>
                <Input
                  type="datetime-local"
                  className="rounded-xl"
                  value={checkInTime}
                  onChange={(e) => setCheckInTime(e.target.value)}
                />
              </div>
              {showLateField && (
                <div className="space-y-1">
                  <Label>Late reason (required)</Label>
                  <Textarea
                    value={lateReason}
                    onChange={(e) => setLateReason(e.target.value)}
                    rows={3}
                    placeholder="Why is this staff member late?"
                    className="rounded-xl"
                  />
                </div>
              )}
            </DialogBody>
            <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
              <Button variant="outline" className="rounded-xl" onClick={() => setModalOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                className="rounded-xl"
                onClick={submitAdminCheckIn}
                disabled={saving || (showLateField && !lateReason.trim())}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm check-in
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default StaffAttendanceDashboard;
