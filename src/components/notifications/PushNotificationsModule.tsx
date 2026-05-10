import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useData } from '@/contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { BellRing, RefreshCw, Send, Users, ListChecks, GraduationCap, Search, Megaphone } from 'lucide-react';

type PushStats = {
  parentAccounts: number;
  subscribedAccounts: number;
  totalEndpoints: number;
  fcmTokens?: number;
  fcmConfigured?: boolean;
  staffUserAccounts?: number;
  staffSubscribedUsers?: number;
  staffPushEndpoints?: number;
};

type Audience = 'all' | 'students' | 'class' | 'staff';

function studentMatchesSearch(
  s: {
    id: string;
    studentId: string;
    admissionNumber: string;
    firstName: string;
    lastName: string;
    classAssigned?: string;
  },
  q: string
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (String(s.id).toLowerCase().includes(t)) return true;
  if (String(s.studentId || '')
    .toLowerCase()
    .includes(t)) {
    return true;
  }
  if (String(s.admissionNumber || '')
    .toLowerCase()
    .includes(t)) {
    return true;
  }
  const name = `${s.firstName} ${s.lastName}`.toLowerCase();
  if (name.includes(t)) return true;
  if ((s.classAssigned || '').toLowerCase().includes(t)) return true;
  return false;
}

function classMatchesSearch(
  c: { id: string; className: string; level?: string; stream?: string },
  q: string
): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  if (String(c.id).toLowerCase().includes(t)) return true;
  if ((c.className || '').toLowerCase().includes(t)) return true;
  if ((c.level || '').toLowerCase().includes(t)) return true;
  if ((c.stream || '').toLowerCase().includes(t)) return true;
  return false;
}

const PushNotificationsModule: React.FC = () => {
  const { hasAccess } = useAuth();
  const { school } = useSchool();
  const { students, classes, loading: dataLoading } = useData();
  const [stats, setStats] = useState<PushStats>({
    parentAccounts: 0,
    subscribedAccounts: 0,
    totalEndpoints: 0,
    fcmTokens: 0,
    fcmConfigured: false,
    staffUserAccounts: 0,
    staffSubscribedUsers: 0,
    staffPushEndpoints: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  const [sending, setSending] = useState(false);
  const [audience, setAudience] = useState<Audience>('all');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [classId, setClassId] = useState<string>('');
  const [studentSearch, setStudentSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [title, setTitle] = useState('Message from school');
  const [message, setMessage] = useState(
    'You have a new message from the school. Open the parent portal to read more.'
  );

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const an = `${a.firstName} ${a.lastName}`.toLowerCase();
      const bn = `${b.firstName} ${b.lastName}`.toLowerCase();
      return an.localeCompare(bn);
    });
  }, [students]);

  const sortedClasses = useMemo(() => {
    return [...classes].sort((a, b) => a.className.localeCompare(b.className));
  }, [classes]);

  const filteredStudents = useMemo(
    () => sortedStudents.filter((s) => studentMatchesSearch(s, studentSearch)),
    [sortedStudents, studentSearch]
  );

  const filteredClasses = useMemo(
    () => sortedClasses.filter((c) => classMatchesSearch(c, classSearch)),
    [sortedClasses, classSearch]
  );

  const selectedSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);

  const toggleStudent = (id: string, checked: boolean) => {
    setSelectedStudentIds((prev) => {
      if (checked) return prev.includes(id) ? prev : [...prev, id];
      return prev.filter((x) => x !== id);
    });
  };

  const selectAllFiltered = () => {
    const ids = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearStudentSelection = () => setSelectedStudentIds([]);

  const loadStats = async () => {
    if (!hasAccess('push-notifications')) return;
    setLoadingStats(true);
    try {
      const res = await apiService.get<PushStats>('/settings/push/stats');
      setStats({
        parentAccounts: Number(res?.parentAccounts || 0),
        subscribedAccounts: Number(res?.subscribedAccounts || 0),
        totalEndpoints: Number(res?.totalEndpoints || 0),
        fcmTokens: Number(res?.fcmTokens || 0),
        fcmConfigured: Boolean(res?.fcmConfigured),
        staffUserAccounts: Number(res?.staffUserAccounts || 0),
        staffSubscribedUsers: Number(res?.staffSubscribedUsers || 0),
        staffPushEndpoints: Number(res?.staffPushEndpoints || 0),
      });
    } catch (err: any) {
      toast({ title: 'Failed to load push stats', description: err?.message, variant: 'destructive' });
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    loadStats().catch(() => undefined);
  }, []);

  const sendPush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (audience === 'students' && selectedStudentIds.length === 0) {
      toast({
        title: 'Select students',
        description: 'Pick at least one student (use search by school student ID, name, or class).',
        variant: 'destructive',
      });
      return;
    }
    if (audience === 'class' && !classId) {
      toast({
        title: 'Choose a class',
        description: 'Select a class to notify all parents of students in that class.',
        variant: 'destructive',
      });
      return;
    }

    const body: Record<string, unknown> = {
      title: title.trim(),
      message: message.trim(),
      audience,
    };
    if (audience === 'students') {
      body.studentIds = selectedStudentIds.map((id) => parseInt(id, 10)).filter((n) => Number.isFinite(n));
    }
    if (audience === 'class') body.classId = parseInt(classId, 10);

    setSending(true);
    try {
      const res = await apiService.post<{
        parentAccounts?: number;
        subscribedAccounts?: number;
        audience?: string;
        staffUserAccounts?: number;
        subscribedUserAccounts?: number;
        subscribedDevices?: number;
      }>('/settings/push/test', body);
      const scope =
        res.audience === 'staff'
          ? 'teachers and staff (school app)'
          : res.audience === 'students'
            ? 'selected students’ parents'
            : res.audience === 'class'
              ? 'parents in the selected class'
              : 'all parents';
      const description =
        res.audience === 'staff'
          ? `Sent to ${scope}: ${res.staffUserAccounts ?? 0} staff/teacher account(s), ${res.subscribedUserAccounts ?? 0} with at least one device, ${res.subscribedDevices ?? 0} push endpoint(s).`
          : `Sent to ${scope}: ${res.parentAccounts ?? 0} parent account(s), ${res.subscribedAccounts ?? 0} with an active device subscription.`;
      toast({
        title: 'Notification sent',
        description,
      });
      await loadStats();
    } catch (err: any) {
      toast({ title: 'Send failed', description: err?.message || 'Could not send push', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (!hasAccess('push-notifications')) return null;

  const audienceCards: { value: Audience; icon: React.ReactNode; label: string; hint: string }[] = [
    {
      value: 'all',
      icon: <Users className="h-5 w-5 shrink-0 text-indigo-600" />,
      label: 'All parents',
      hint: 'Every parent portal account for this school',
    },
    {
      value: 'students',
      icon: <ListChecks className="h-5 w-5 shrink-0 text-indigo-600" />,
      label: 'Selected students',
      hint: 'Pick one or more pupils by school student ID; their parent portal accounts receive the message',
    },
    {
      value: 'class',
      icon: <GraduationCap className="h-5 w-5 shrink-0 text-indigo-600" />,
      label: 'One class',
      hint: 'Parents of all students currently assigned to the class',
    },
    {
      value: 'staff',
      icon: <Megaphone className="h-5 w-5 shrink-0 text-indigo-600" />,
      label: 'Teachers & staff',
      hint: 'Teacher and payroll staff accounts using the school app (not parents)',
    },
  ];

  return (
    <div className="w-full min-h-0 px-4 py-6 sm:px-8 lg:px-12 xl:px-14 max-w-[min(100%,1680px)] mx-auto space-y-8 lg:space-y-10 pb-12">
      <div className="flex flex-col gap-5 lg:gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4 lg:gap-5">
          <div className="w-14 h-14 lg:w-16 lg:h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <BellRing className="w-8 h-8 lg:w-9 lg:h-9 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-gray-900">Push notifications</h1>
            <p className="text-gray-600 mt-2 text-base lg:text-lg max-w-3xl">
              Send web push to parents (parent portal) or to teachers and payroll staff (school app). Same VAPID keys;
              staff must open the school app once and allow notifications to register their device.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={loadStats} disabled={loadingStats} className="shrink-0 h-11 px-5">
          {loadingStats ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Refresh stats
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 lg:gap-6">
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parent accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.parentAccounts}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Subscribed accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.subscribedAccounts}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Device endpoints</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.totalEndpoints}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm min-h-[120px] sm:col-span-2 xl:col-span-1">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">FCM tokens</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.fcmTokens || 0}</p>
            <p className={cn('text-xs mt-2', stats.fcmConfigured ? 'text-emerald-600' : 'text-amber-600')}>
              {stats.fcmConfigured ? 'Firebase configured' : 'Firebase not configured'}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 lg:gap-6">
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teacher &amp; staff accounts</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.staffUserAccounts ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff with push enabled</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.staffSubscribedUsers ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 shadow-sm min-h-[120px]">
          <CardHeader className="pb-2 pt-5 px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">Staff push endpoints</CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-5">
            <p className="text-3xl lg:text-4xl font-semibold tabular-nums">{stats.staffPushEndpoints ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200/80 shadow-md overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-indigo-50/40 border-b py-6 px-6 sm:px-8 lg:px-10 lg:py-8">
          <CardTitle className="text-xl lg:text-2xl">Compose notification</CardTitle>
          <CardDescription className="text-base mt-2 max-w-4xl">
            Each row highlights the school Student ID (the pupil code used day to day). A small record id is shown for
            admin reference. Search matches student ID, admission number, record id, name, or class.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 pb-10 px-6 sm:px-8 lg:px-10">
          <form onSubmit={sendPush} className="space-y-8 lg:space-y-10">
            <div className="space-y-4">
              <Label className="text-base lg:text-lg">Who should receive this?</Label>
              <RadioGroup
                value={audience}
                onValueChange={(v) => setAudience(v as Audience)}
                className="grid gap-4 lg:gap-5 sm:grid-cols-2 xl:grid-cols-4"
              >
                {audienceCards.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`push-aud-${opt.value}`}
                    className={cn(
                      'flex cursor-pointer gap-3 lg:gap-4 rounded-xl border p-5 lg:p-6 min-h-[7.25rem] lg:min-h-[8rem] transition-colors items-start',
                      audience === opt.value
                        ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    )}
                  >
                    <RadioGroupItem value={opt.value} id={`push-aud-${opt.value}`} className="mt-0.5" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        {opt.icon}
                        {opt.label}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-2 leading-relaxed">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {audience === 'students' && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 lg:p-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Label className="text-base lg:text-lg sm:pt-0.5">Students (school Student ID)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="default" onClick={selectAllFiltered} disabled={dataLoading}>
                      Select all in list
                    </Button>
                    <Button type="button" variant="ghost" size="default" onClick={clearStudentSelection}>
                      Clear
                    </Button>
                  </div>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-white h-11 text-base"
                    placeholder="Search by school student ID, admission no., record id, name, or class…"
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    disabled={dataLoading}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedStudentIds.length} selected
                  {filteredStudents.length !== sortedStudents.length
                    ? ` · ${filteredStudents.length} shown (${sortedStudents.length} total)`
                    : ` · ${sortedStudents.length} students`}
                </p>
                <ScrollArea className="h-[min(560px,65dvh)] sm:h-[min(520px,62dvh)] rounded-lg border bg-white">
                  <ul className="divide-y divide-slate-100 p-3 sm:p-4">
                    {filteredStudents.map((s) => {
                      const checked = selectedSet.has(s.id);
                      const sid = (s.studentId || '').trim();
                      const adm = (s.admissionNumber || '').trim();
                      return (
                        <li key={s.id} className="flex items-start gap-4 py-3.5 sm:py-4 px-1">
                          <Checkbox
                            id={`push-stu-${s.id}`}
                            checked={checked}
                            onCheckedChange={(v) => toggleStudent(s.id, v === true)}
                            className="mt-1.5 h-5 w-5"
                          />
                          <label htmlFor={`push-stu-${s.id}`} className="flex-1 cursor-pointer min-w-0">
                            <div className="font-mono text-base sm:text-lg font-semibold text-indigo-800 tracking-tight">
                              Student ID: {sid || '—'}
                            </div>
                            <div className="font-medium text-gray-900 text-base mt-1">
                              {s.firstName} {s.lastName}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1.5">
                              {s.classAssigned ? <span>{s.classAssigned}</span> : null}
                              {adm && adm !== sid ? <span className="font-mono">Admission: {adm}</span> : null}
                              <span className="font-mono text-slate-500">Record id {s.id}</span>
                            </div>
                          </label>
                        </li>
                      );
                    })}
                    {filteredStudents.length === 0 ? (
                      <li className="py-12 text-center text-muted-foreground">No students match this search.</li>
                    ) : null}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {audience === 'class' && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 sm:p-6 lg:p-8">
                <Label className="text-base lg:text-lg">Class (record id and name)</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9 bg-white h-11 text-base"
                    placeholder="Search by class record id, name, level, or stream…"
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    disabled={dataLoading}
                  />
                </div>
                <ScrollArea className="h-[min(440px,52dvh)] rounded-lg border bg-white">
                  <ul className="p-3 sm:p-4 space-y-2">
                    {filteredClasses.map((c) => {
                      const selected = classId === c.id;
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => setClassId(c.id)}
                            className={cn(
                              'w-full text-left rounded-lg border px-4 py-3.5 sm:py-4 transition-colors',
                              selected
                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500/20'
                                : 'border-transparent hover:bg-slate-50'
                            )}
                          >
                            <div className="font-mono text-sm sm:text-base font-semibold text-indigo-800">
                              Class record id {c.id}
                            </div>
                            <div className="font-medium text-gray-900 text-base mt-0.5">{c.className}</div>
                            {[c.level, c.stream].filter(Boolean).length > 0 ? (
                              <p className="text-sm text-muted-foreground mt-1">
                                {[c.level, c.stream].filter(Boolean).join(' · ')}
                              </p>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                    {filteredClasses.length === 0 ? (
                      <li className="py-12 text-center text-muted-foreground">No classes match this search.</li>
                    ) : null}
                  </ul>
                </ScrollArea>
              </div>
            )}

            <div className="grid gap-6 lg:gap-8 sm:grid-cols-1 max-w-4xl">
              <div className="space-y-2">
                <Label htmlFor="pushTitle" className="text-base">
                  Title
                </Label>
                <Input
                  id="pushTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                  required
                  className="bg-white h-11 text-base max-w-3xl"
                />
                <p className="text-xs text-muted-foreground">{title.length}/120</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pushBody" className="text-base">
                  Message
                </Label>
                <Textarea
                  id="pushBody"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={300}
                  rows={6}
                  required
                  className="bg-white resize-y min-h-[140px] text-base max-w-3xl"
                  placeholder={
                    audience === 'staff'
                      ? 'Write the message teachers and staff will see on their device…'
                      : 'Write the message parents will see…'
                  }
                />
                <p className="text-xs text-muted-foreground">{message.length}/300</p>
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto min-w-[220px] h-12 text-base" size="lg" disabled={sending || dataLoading}>
              {sending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              {sending
                ? 'Sending…'
                : audience === 'staff'
                  ? `Send to staff — ${school?.name || 'school'}`
                  : `Send to ${school?.name || 'parents'}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default PushNotificationsModule;
