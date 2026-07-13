import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  Search,
  UserCheck,
  UserX,
  Clock,
  RefreshCw,
  Users,
  HandHelping,
  LogIn,
  LogOut,
  X,
} from 'lucide-react';
import { checkinService } from '@/services/checkinService';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface TeacherClass {
  id: number;
  class_name: string;
}

type TabId = 'assist' | 'class';

function studentName(s: any) {
  return `${s.firstName || s.first_name || ''} ${s.lastName || s.last_name || ''}`.trim() || 'Student';
}

function studentInitials(s: any) {
  const a = (s.firstName || s.first_name || '?')[0];
  const b = (s.lastName || s.last_name || '?')[0];
  return `${a}${b}`.toUpperCase();
}

function studentIdLabel(s: any) {
  return s.studentId || s.student_id || s.admissionNumber || s.admission_number || '';
}

function classLabel(s: any) {
  return s.className || s.class_name || 'No class';
}

const StaffCheckinPanel: React.FC = () => {
  const { students } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<TabId>('assist');
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [liveStatus, setLiveStatus] = useState<Map<number, { action: string | null; time: string | null }>>(new Map());
  const [statusLoading, setStatusLoading] = useState(false);

  const isTeacher = user?.role === 'teacher' || user?.role === 'headmaster' || !!(user?.role === 'staff' && user?.teacherId);

  useEffect(() => {
    if (!isTeacher) return;
    apiService.get<TeacherClass[]>('/teachers/me/classes').then(setTeacherClasses).catch(() => {});
  }, [isTeacher]);

  const fetchLiveStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await checkinService.getStatus();
      if (Array.isArray(data)) {
        const map = new Map<number, { action: string | null; time: string | null }>();
        data.forEach((s: any) => {
          map.set(Number(s.id), { action: s.last_action, time: s.last_action_time });
        });
        setLiveStatus(map);
      }
    } catch {
      /* silent */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLiveStatus();
  }, [fetchLiveStatus]);

  const classStudents = useMemo(() => {
    const ids = new Set(teacherClasses.map((tc) => Number(tc.id)));
    return (students || []).filter((s: any) => ids.has(Number(s.classAssignedId)));
  }, [students, teacherClasses]);

  const groupedByClass = useMemo(
    () =>
      teacherClasses
        .map((tc) => ({
          ...tc,
          students: classStudents.filter((s: any) => Number(s.classAssignedId) === tc.id),
        }))
        .filter((g) => g.students.length > 0),
    [teacherClasses, classStudents]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const pool = isTeacher && teacherClasses.length > 0 ? classStudents : students || [];
    return pool
      .filter((s: any) => {
        return (
          (s.firstName || s.first_name || '').toLowerCase().includes(q) ||
          (s.lastName || s.last_name || '').toLowerCase().includes(q) ||
          studentName(s).toLowerCase().includes(q) ||
          studentIdLabel(s).toLowerCase().includes(q) ||
          classLabel(s).toLowerCase().includes(q)
        );
      })
      .slice(0, 12);
  }, [search, students, classStudents, isTeacher, teacherClasses.length]);

  const selectedStudent = selectedId
    ? (students || []).find((s: any) => Number(s.id) === selectedId)
    : null;

  const getStudentStatus = (s: any) => liveStatus.get(Number(s.id)) || { action: null, time: null };

  const handleCheckin = async (studentId: number, action: 'check_in' | 'check_out') => {
    setProcessing(true);
    try {
      await checkinService.manualCheckin(studentId, action);
      toast({
        title: action === 'check_in' ? 'Student checked in' : 'Student checked out',
        description: 'Recorded to help the parent — campus status updated.',
      });
      setSelectedId(null);
      setSearch('');
      await fetchLiveStatus();
    } catch (err: unknown) {
      toast({
        title: 'Could not update',
        description: err instanceof Error ? err.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const onCampusCount = useMemo(() => {
    let n = 0;
    for (const s of classStudents) {
      if (getStudentStatus(s).action === 'check_in') n += 1;
    }
    return n;
  }, [classStudents, liveStatus]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-5 animate-in fade-in duration-300">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-gradient-to-br from-slate-900 via-sky-950 to-indigo-950 p-6 text-white shadow-lg">
        <div className="absolute -right-8 -top-8 h-36 w-36 rounded-full bg-sky-400/15 blur-2xl" />
        <div className="relative space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-100 ring-1 ring-sky-400/30">
            <HandHelping className="h-3.5 w-3.5" />
            Assist parents
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Student Check-in</h1>
          <p className="text-sm text-white/75 max-w-xl">
            Help parents complete drop-off and pick-up when they cannot scan the QR code. Search a student or use your class list.
          </p>
          {isTeacher && (
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge className="bg-white/15 text-white border-0 hover:bg-white/20">
                {classStudents.length} in your classes
              </Badge>
              <Badge className="bg-emerald-500/25 text-emerald-50 border-0 hover:bg-emerald-500/30">
                {onCampusCount} on campus now
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted/80 p-1">
        <button
          type="button"
          onClick={() => {
            setTab('assist');
            setSelectedId(null);
          }}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
            tab === 'assist' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Search className="h-4 w-4" />
          Help a parent
        </button>
        {isTeacher && (
          <button
            type="button"
            onClick={() => {
              setTab('class');
              setSelectedId(null);
              void fetchLiveStatus();
            }}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
              tab === 'class' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="h-4 w-4" />
            My class
          </button>
        )}
      </div>

      {/* Assist tab */}
      {tab === 'assist' && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Find student</CardTitle>
              <CardDescription>
                Type a name or student ID, then record check-in or check-out for the parent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedId(null);
                  }}
                  placeholder="Search by name or student ID…"
                  className="h-11 pl-10 rounded-xl"
                  autoFocus
                />
              </div>

              {search.trim() && !selectedId && (
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border max-h-72 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">No matching students</p>
                  ) : (
                    filtered.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedId(Number(s.id))}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="h-10 w-10 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 flex items-center justify-center text-sm font-bold shrink-0">
                          {studentInitials(s)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate">{studentName(s)}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {classLabel(s)}
                            {studentIdLabel(s) ? ` · ${studentIdLabel(s)}` : ''}
                          </p>
                        </div>
                        {getStudentStatus(s).action === 'check_in' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-0 shrink-0">On campus</Badge>
                        ) : getStudentStatus(s).action ? (
                          <Badge variant="secondary" className="shrink-0">Off campus</Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0 text-amber-700 border-amber-300">No record</Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}

              {!search.trim() && !selectedId && (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
                  <HandHelping className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm font-medium text-foreground">Ready to assist</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    When a parent cannot scan the QR code, search their child here and tap Check In or Check Out.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedStudent && selectedId && (
            <Card className="rounded-2xl border-sky-200 dark:border-sky-900 shadow-md overflow-hidden">
              <div className="bg-sky-50/80 dark:bg-sky-950/40 px-5 py-4 flex items-start justify-between gap-3 border-b border-sky-100 dark:border-sky-900">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-sky-600 text-white flex items-center justify-center text-base font-bold shrink-0">
                    {studentInitials(selectedStudent)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate">{studentName(selectedStudent)}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {classLabel(selectedStudent)}
                      {studentIdLabel(selectedStudent) ? ` · ${studentIdLabel(selectedStudent)}` : ''}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => {
                    setSelectedId(null);
                    setSearch('');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-5 space-y-4">
                <p className="text-xs text-muted-foreground text-center">
                  Confirm with the parent, then record the action below.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    type="button"
                    disabled={processing}
                    onClick={() => void handleCheckin(selectedId, 'check_in')}
                    className="h-auto min-h-[88px] flex-col gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-4"
                  >
                    {processing ? (
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    ) : (
                      <LogIn className="h-6 w-6" />
                    )}
                    <span className="text-sm font-bold">Check In</span>
                    <span className="text-[11px] font-normal text-emerald-100">Drop-off / arrived</span>
                  </Button>
                  <Button
                    type="button"
                    disabled={processing}
                    variant="outline"
                    onClick={() => void handleCheckin(selectedId, 'check_out')}
                    className="h-auto min-h-[88px] flex-col gap-1.5 rounded-xl border-sky-300 text-sky-800 hover:bg-sky-50 dark:border-sky-700 dark:text-sky-200 dark:hover:bg-sky-950 py-4"
                  >
                    {processing ? (
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    ) : (
                      <LogOut className="h-6 w-6" />
                    )}
                    <span className="text-sm font-bold">Check Out</span>
                    <span className="text-[11px] font-normal text-muted-foreground">Pick-up / leaving</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* My class tab */}
      {tab === 'class' && isTeacher && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">Quick In / Out for students in your classes</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void fetchLiveStatus()} disabled={statusLoading}>
              <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', statusLoading && 'animate-spin')} />
              Refresh
            </Button>
          </div>

          {groupedByClass.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-12 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No students in your classes</p>
                <p className="text-xs text-muted-foreground mt-1">Use Help a parent to search the whole school.</p>
              </CardContent>
            </Card>
          ) : (
            groupedByClass.map((group) => (
              <Card key={group.id} className="rounded-2xl overflow-hidden shadow-sm">
                <CardHeader className="py-3 px-4 bg-muted/40 border-b border-border">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-sky-600" />
                    {group.class_name}
                    <Badge variant="secondary" className="ml-auto font-normal">
                      {group.students.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border">
                  {group.students.map((s: any) => {
                    const status = getStudentStatus(s);
                    const onCampus = status.action === 'check_in';
                    return (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-full bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200 flex items-center justify-center text-xs font-bold shrink-0">
                            {studentInitials(s)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{studentName(s)}</p>
                            <p className="text-[11px] text-muted-foreground truncate">
                              {studentIdLabel(s)}
                              {status.time
                                ? ` · ${new Date(status.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full',
                              onCampus
                                ? 'text-emerald-700 bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300'
                                : status.action
                                  ? 'text-slate-600 bg-slate-100 dark:bg-slate-800'
                                  : 'text-amber-700 bg-amber-50 dark:bg-amber-950/40'
                            )}
                          >
                            {onCampus ? <UserCheck className="w-3 h-3" /> : status.action ? <UserX className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {onCampus ? 'On campus' : status.action ? 'Left' : '—'}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            disabled={processing}
                            onClick={() => void handleCheckin(Number(s.id), 'check_in')}
                            className="h-8 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          >
                            In
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={processing}
                            onClick={() => void handleCheckin(Number(s.id), 'check_out')}
                            className="h-8 px-2.5 rounded-lg text-xs"
                          >
                            Out
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StaffCheckinPanel;
