import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RefreshCw,
  Users,
  Clock,
  UserCheck,
  UserX,
  Search,
  Download,
  LogIn,
  LogOut,
  GraduationCap,
  Hash,
  IdCard,
  ChevronRight,
} from 'lucide-react';
import { checkinService, CheckinStudent, CheckinRecord } from '@/services/checkinService';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function statusMeta(status?: CheckinStudent['current_status']) {
  if (status === 'on_campus') {
    return {
      label: 'On Campus',
      badge: 'bg-emerald-100 text-emerald-800 border-0',
      avatar: 'bg-emerald-100 text-emerald-800',
      icon: UserCheck,
    };
  }
  if (status === 'off_campus') {
    return {
      label: 'Left School',
      badge: 'bg-slate-100 text-slate-600 border-0',
      avatar: 'bg-slate-100 text-slate-500',
      icon: UserX,
    };
  }
  return {
    label: 'No Record',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    avatar: 'bg-amber-50 text-amber-600',
    icon: Clock,
  };
}

function formatWhen(iso?: string | null) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return iso;
  }
}

const CheckinDashboard: React.FC = () => {
  const { classes, refresh } = useData();
  const [students, setStudents] = useState<CheckinStudent[]>([]);
  const [history, setHistory] = useState<CheckinRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'status' | 'history'>('status');
  const [selected, setSelected] = useState<CheckinStudent | null>(null);
  const [detailHistory, setDetailHistory] = useState<CheckinRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!classes?.length) {
      void refresh(['classes']).catch(() => undefined);
    }
  }, [classes?.length, refresh]);

  const classOptions = useMemo(
    () =>
      [...(classes || [])]
        .filter((c) => c.className?.trim())
        .sort((a, b) => a.className.localeCompare(b.className)),
    [classes]
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const classId = classFilter !== 'all' ? classFilter : undefined;
      const [statusData, historyData] = await Promise.all([
        checkinService.getStatus(classId),
        checkinService.getHistory({ classId, limit: 50 }),
      ]);
      setStudents(Array.isArray(statusData) ? statusData : []);
      setHistory(historyData?.items || []);
    } catch {
      setStudents([]);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [classFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const openStudentDetail = async (student: CheckinStudent) => {
    setSelected(student);
    setDetailHistory([]);
    setDetailLoading(true);
    try {
      const rows = await checkinService.getStudentHistory(String(student.id));
      setDetailHistory(Array.isArray(rows) ? rows : []);
    } catch {
      setDetailHistory([]);
    } finally {
      setDetailLoading(false);
    }
  };

  const filteredStudents = students.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.first_name.toLowerCase().includes(q) ||
      s.last_name.toLowerCase().includes(q) ||
      s.student_id.toLowerCase().includes(q) ||
      (s.admission_number || '').toLowerCase().includes(q) ||
      (s.class_name || '').toLowerCase().includes(q)
    );
  });

  const onCampus = students.filter((s) => s.current_status === 'on_campus');
  const offCampus = students.filter((s) => s.current_status === 'off_campus');
  const noRecord = students.filter((s) => s.current_status === 'no_record');

  const exportCsv = () => {
    const rows = [['Student Name', 'Student ID', 'Admission No', 'Class', 'Status', 'Last Action Time'].join(',')];
    for (const s of students) {
      rows.push(
        [
          `"${s.first_name} ${s.last_name}"`,
          s.student_id,
          s.admission_number || '',
          s.class_name || '',
          s.current_status === 'on_campus' ? 'On Campus' : s.current_status === 'off_campus' ? 'Left' : 'No Record',
          s.last_action_time ? new Date(s.last_action_time).toLocaleString() : '',
        ].join(',')
      );
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-status-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedMeta = statusMeta(selected?.current_status);

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6 space-y-5 animate-in fade-in duration-300">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
              <UserCheck className="h-3.5 w-3.5" />
              Campus presence
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Student Check-in</h1>
            <p className="text-sm text-white/75 max-w-xl">
              Live view of who is on campus today. Filter by class, search students, and open a profile for more detail.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={exportCsv}
              className="bg-white/10 text-white border-0 hover:bg-white/20"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Export
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void fetchData()}
              disabled={loading}
              className="bg-emerald-500 hover:bg-emerald-400 text-white border-0"
            >
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: 'On Campus',
            value: onCampus.length,
            hint: 'Checked in now',
            icon: UserCheck,
            tone: 'border-emerald-200 bg-emerald-50 text-emerald-800',
            iconTone: 'bg-emerald-600 text-white',
          },
          {
            label: 'Left School',
            value: offCampus.length,
            hint: 'Checked out today',
            icon: UserX,
            tone: 'border-slate-200 bg-slate-50 text-slate-700',
            iconTone: 'bg-slate-600 text-white',
          },
          {
            label: 'No Record',
            value: noRecord.length,
            hint: 'Not seen today',
            icon: Clock,
            tone: 'border-amber-200 bg-amber-50 text-amber-800',
            iconTone: 'bg-amber-500 text-white',
          },
        ].map((card) => (
          <Card key={card.label} className={cn('rounded-2xl shadow-sm border', card.tone)}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', card.iconTone)}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
                <p className="text-2xl font-bold tabular-nums leading-tight">{card.value}</p>
                <p className="text-[11px] opacity-70">{card.hint}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, student ID, admission no…"
              className="h-10 pl-9 rounded-xl"
            />
          </div>
          <div className="w-full md:w-56">
            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue placeholder="All classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classOptions.map((cls) => (
                  <SelectItem key={cls.id} value={String(cls.id)}>
                    {cls.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/80 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('status')}
          className={cn(
            'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'status' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Current Status ({filteredStudents.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={cn(
            'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors',
            activeTab === 'history' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Today&apos;s Activity ({history.length})
        </button>
      </div>

      {/* Status list */}
      {activeTab === 'status' && (
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <CardTitle className="text-base">Students</CardTitle>
            <CardDescription>Tap a student to see ID details and recent check-in history.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && students.length === 0 ? (
              <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">
                  {students.length === 0 ? 'No opted-in students found' : 'No students match your search'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredStudents.map((s) => {
                  const meta = statusMeta(s.current_status);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void openStudentDetail(s)}
                      className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-muted/40 transition-colors"
                    >
                      <div
                        className={cn(
                          'h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                          meta.avatar
                        )}
                      >
                        {s.first_name?.[0]}
                        {s.last_name?.[0]}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {s.first_name} {s.last_name}
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap className="h-3 w-3" />
                            {s.class_name || 'No class'}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {s.student_id}
                          </span>
                          {s.admission_number ? (
                            <span className="inline-flex items-center gap-1">
                              <IdCard className="h-3 w-3" />
                              {s.admission_number}
                            </span>
                          ) : null}
                        </div>
                        {s.last_action_time && (
                          <p className="text-[11px] text-muted-foreground/80">
                            Last {s.last_action === 'check_in' ? 'in' : 'out'} · {formatWhen(s.last_action_time)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={meta.badge}>
                          <Icon className="h-3 w-3 mr-1" />
                          {meta.label}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity */}
      {activeTab === 'history' && (
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <CardTitle className="text-base">Today&apos;s Activity</CardTitle>
            <CardDescription>Recent check-ins and check-outs across campus.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {history.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No check-in activity today</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {history.map((r) => (
                  <div key={r.id} className="px-4 py-3.5 flex items-center gap-3">
                    <div
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                        r.action === 'check_in' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
                      )}
                    >
                      {r.action === 'check_in' ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.class_name || 'No class'}
                        {r.student_id ? ` · ${r.student_id}` : ''}
                        {r.admission_number ? ` · Adm ${r.admission_number}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge
                        className={
                          r.action === 'check_in'
                            ? 'bg-emerald-100 text-emerald-800 border-0'
                            : 'bg-sky-100 text-sky-800 border-0'
                        }
                      >
                        {r.action === 'check_in' ? 'Check-in' : 'Check-out'}
                      </Badge>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {formatWhen(r.action_time)}
                        {r.performed_by_type === 'staff' ? ' · staff' : ' · parent'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Student detail */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          {selected && (
            <>
              <div className="bg-gradient-to-br from-emerald-600 to-teal-700 px-6 pt-6 pb-5 text-white pr-12">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-lg font-bold shrink-0">
                    {selected.first_name?.[0]}
                    {selected.last_name?.[0]}
                  </div>
                  <div className="min-w-0">
                    <DialogHeader className="space-y-1 text-left">
                      <DialogTitle className="text-white text-xl truncate">
                        {selected.first_name} {selected.last_name}
                      </DialogTitle>
                      <DialogDescription className="text-emerald-50/90">
                        {selected.class_name || 'No class assigned'}
                      </DialogDescription>
                    </DialogHeader>
                  </div>
                </div>
                <div className="mt-4">
                  <Badge className={cn(selectedMeta.badge, 'text-xs')}>{selectedMeta.label}</Badge>
                </div>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Hash className="h-3 w-3" /> Student ID
                    </p>
                    <p className="text-sm font-semibold mt-1 break-all">{selected.student_id || '—'}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <IdCard className="h-3 w-3" /> Admission
                    </p>
                    <p className="text-sm font-semibold mt-1 break-all">{selected.admission_number || '—'}</p>
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-3 col-span-2">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Last action today
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {selected.last_action
                        ? `${selected.last_action === 'check_in' ? 'Check-in' : 'Check-out'} · ${formatWhen(selected.last_action_time)}`
                        : 'No activity recorded today'}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Recent history
                  </p>
                  {detailLoading ? (
                    <div className="py-6 flex justify-center text-muted-foreground text-sm gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                    </div>
                  ) : detailHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center border rounded-xl border-dashed">
                      No check-in history yet
                    </p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto rounded-xl border divide-y">
                      {detailHistory.slice(0, 12).map((r) => (
                        <div key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {r.action === 'check_in' ? (
                              <LogIn className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                            ) : (
                              <LogOut className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                            )}
                            <span className="font-medium">
                              {r.action === 'check_in' ? 'Check-in' : 'Check-out'}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              · {r.performed_by_type === 'staff' ? 'staff' : 'parent'}
                              {r.method === 'manual' ? ' (manual)' : ''}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{formatWhen(r.action_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckinDashboard;
