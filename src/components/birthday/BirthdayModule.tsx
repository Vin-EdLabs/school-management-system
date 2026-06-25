import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Cake, Gift, Sparkles, Users, GraduationCap, Calendar, MessageSquare, Loader2 } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface BirthdayPerson {
  id: number;
  fullName: string;
  type: 'student' | 'teacher';
  dateOfBirth: string;
  age: number;
  classId?: number | null;
  className?: string | null;
  photoUrl?: string | null;
}

interface BirthdayGroup {
  date: string;
  dayLabel: string;
  people: BirthdayPerson[];
}

interface MonthSection {
  label: string;
  year: number;
  month: number;
  groups: BirthdayGroup[];
}

type BirthdayMessageConfig = {
  studentParentTitle: string;
  studentParentMessage: string;
  classTeacherTitle: string;
  classTeacherMessage: string;
  teacherStaffTitle: string;
  teacherStaffMessage: string;
};

function renderPreview(template: string, name = 'Ama Mensah', age = 10, className = 'Primary 4A') {
  return template
    .replace(/\{\{name\}\}/gi, name)
    .replace(/\{\{age\}\}/gi, String(age))
    .replace(/\{\{class\}\}/gi, className);
}

function formatMonthDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

function BirthdayGroupList({ groups }: { groups: BirthdayGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">No birthdays this month.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <p className="text-sm font-semibold text-gray-700">{formatMonthDay(group.date)}</p>
            <Badge variant="outline" className="text-xs">
              {group.people.length}
            </Badge>
          </div>
          <div className="ml-4 space-y-1.5">
            {group.people.map((person) => (
              <div
                key={`u-${person.type}-${person.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/30 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                  {person.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {person.fullName}
                    <span className="font-normal text-gray-400 ml-1 text-xs">turns {person.age}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {person.type === 'student' ? 'Student' : 'Teacher'}
                    {person.className && ` · ${person.className}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const BirthdayModule = () => {
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const isAdmin = user?.role === 'super-admin' || user?.role === 'administrator';
  const isTeacherClassView = user?.role === 'teacher' || !!user?.teacherId;
  const [todayBirthdays, setTodayBirthdays] = useState<BirthdayPerson[]>([]);
  const [monthSection, setMonthSection] = useState<MonthSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [messageConfig, setMessageConfig] = useState<BirthdayMessageConfig | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  useEffect(() => {
    const fetchBirthdays = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        apiService.setTenantContext(schoolId);
        const [todayRes, sectionsRes] = await Promise.all(
          isTeacherClassView
            ? [
                apiService.get<BirthdayPerson[]>('/birthdays/my-classes/today'),
                apiService.get<MonthSection>('/birthdays/my-classes/upcoming?scope=months'),
              ]
            : [
                apiService.get<BirthdayPerson[]>('/birthdays/today'),
                apiService.get<MonthSection>('/birthdays/upcoming?scope=months'),
              ]
        );
        setTodayBirthdays(Array.isArray(todayRes) ? todayRes : []);
        setMonthSection(sectionsRes);
      } catch {
        setTodayBirthdays([]);
        setMonthSection(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBirthdays();
  }, [schoolId, isTeacherClassView]);

  useEffect(() => {
    if (!schoolId || !isAdmin) {
      setMessageConfig(null);
      return;
    }
    setLoadingTemplate(true);
    void apiService
      .get<{ config: BirthdayMessageConfig }>('/birthdays/settings')
      .then((res) => setMessageConfig(res.config))
      .catch(() => setMessageConfig(null))
      .finally(() => setLoadingTemplate(false));
  }, [schoolId, isAdmin]);

  const parentPreview = useMemo(() => {
    if (!messageConfig) return '';
    return renderPreview(messageConfig.studentParentMessage);
  }, [messageConfig]);

  const handleSaveTemplate = async () => {
    if (!messageConfig) return;
    setSavingTemplate(true);
    try {
      const res = await apiService.put<{ config: BirthdayMessageConfig }>('/birthdays/settings', messageConfig);
      setMessageConfig(res.config);
      toast({ title: 'Template saved', description: 'Birthday auto-messages will use this wording from now on.' });
    } catch (e: unknown) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save template',
        variant: 'destructive',
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const updateConfig = (key: keyof BirthdayMessageConfig, value: string) => {
    setMessageConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const todayStudents = todayBirthdays.filter((p) => p.type === 'student');
  const todayTeachers = isTeacherClassView ? [] : todayBirthdays.filter((p) => p.type === 'teacher');
  const monthCount = monthSection?.groups.reduce((sum, g) => sum + g.people.length, 0) ?? 0;

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
          <Cake className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">
            {isTeacherClassView ? 'My Class Birthdays' : 'Birthdays'}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isTeacherClassView
              ? 'Students in your classes who are celebrating birthdays'
              : 'Celebrate students and teachers on their special day'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse text-slate-500">Loading birthdays...</div>
      ) : (
        <>
          {isAdmin && messageConfig && (
            <Card className="border-emerald-200/60 dark:border-emerald-800/40">
              <CardHeader className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  Auto-send message template
                </CardTitle>
                <CardDescription>
                  Parents receive this once on a student&apos;s birthday. Use {'{{name}}'}, {'{{age}}'}, and {'{{class}}'} in the message.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {loadingTemplate ? (
                  <p className="text-sm text-muted-foreground">Loading template…</p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="birthday-parent-title">Notification title (parents)</Label>
                      <Input
                        id="birthday-parent-title"
                        value={messageConfig.studentParentTitle}
                        onChange={(e) => updateConfig('studentParentTitle', e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="birthday-parent-message">Message to parents</Label>
                      <Textarea
                        id="birthday-parent-message"
                        value={messageConfig.studentParentMessage}
                        onChange={(e) => updateConfig('studentParentMessage', e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 mb-1">Preview</p>
                      <p className="font-medium text-foreground">{messageConfig.studentParentTitle}</p>
                      <p className="text-muted-foreground mt-1">{parentPreview}</p>
                    </div>

                    <details className="rounded-xl border border-border/70 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-foreground">Staff & class teacher messages (optional)</summary>
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Class teacher title</Label>
                            <Input
                              value={messageConfig.classTeacherTitle}
                              onChange={(e) => updateConfig('classTeacherTitle', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Class teacher message</Label>
                            <Textarea
                              value={messageConfig.classTeacherMessage}
                              onChange={(e) => updateConfig('classTeacherMessage', e.target.value)}
                              rows={2}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Teacher birthday title (all staff)</Label>
                            <Input
                              value={messageConfig.teacherStaffTitle}
                              onChange={(e) => updateConfig('teacherStaffTitle', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label>Teacher birthday message</Label>
                            <Textarea
                              value={messageConfig.teacherStaffMessage}
                              onChange={(e) => updateConfig('teacherStaffMessage', e.target.value)}
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </details>

                    <div className="flex justify-end">
                      <Button variant="primaryAction" onClick={() => void handleSaveTemplate()} disabled={savingTemplate}>
                        {savingTemplate ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                        Save template
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {todayBirthdays.length > 0 && (
            <Card className="border-amber-300/60 dark:border-amber-700/40 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="w-5 h-5 text-amber-500" />
                  {isTeacherClassView ? "Today's Class Birthdays" : "Today's Birthdays"}
                  <Badge className="ml-auto bg-amber-500 text-white">{todayBirthdays.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {todayStudents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                      <Users className="w-4 h-4" /> Students ({todayStudents.length})
                    </h3>
                    <div className="space-y-2">
                      {todayStudents.map((person) => (
                        <div
                          key={`s-${person.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/40"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {person.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {person.fullName}
                              <span className="font-normal text-gray-500 ml-1">turns {person.age}!</span>
                            </p>
                            <p className="text-xs text-gray-500">{person.className && `${person.className}`}</p>
                          </div>
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {todayTeachers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                      <GraduationCap className="w-4 h-4" /> Teachers ({todayTeachers.length})
                    </h3>
                    <div className="space-y-2">
                      {todayTeachers.map((person) => (
                        <div
                          key={`t-${person.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/10 border border-purple-200/40"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {person.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {person.fullName}
                              <span className="font-normal text-gray-500 ml-1">turns {person.age}!</span>
                            </p>
                            {person.className && <p className="text-xs text-gray-500">{person.className}</p>}
                          </div>
                          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {todayBirthdays.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Cake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-1">
                  {isTeacherClassView ? 'No class birthdays today' : 'No birthdays today'}
                </h3>
                <p className="text-sm text-gray-500">
                  {isTeacherClassView
                    ? 'None of your students have a birthday today. See upcoming class birthdays below.'
                    : 'See remaining birthdays for this month below.'}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
                {isTeacherClassView
                  ? `Upcoming in ${monthSection?.label ?? 'this month'}`
                  : (monthSection?.label ?? 'This Month')}
                <Badge variant="secondary" className="ml-auto">
                  {monthCount} this month
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BirthdayGroupList groups={monthSection?.groups ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default BirthdayModule;
