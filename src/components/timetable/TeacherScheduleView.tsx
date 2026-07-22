import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Clock, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import {
  fetchLedgerTerms, fetchTeacherExams, fetchTeacherTimetable, type ClassTimetableGrid, type ExamEntry, type LedgerTerm,
} from '@/services/timetableApi';
import TimetableGrid from './TimetableGrid';
import {
  classAccentColor,
  findNextClassToday,
  formatExamDate,
  formatTimeRange,
  formatTimeRangeCompact,
  timetableCardClass,
  timetableEmptyStateClass,
  timetableLabelClass,
  timetableMutedPanelClass,
  timetableNativeSelectClass,
  timetableTabsListClass,
} from './timetableUtils';

export default function TeacherScheduleView() {
  const { user } = useAuth();
  const { activeLedgerTermId } = useActiveTerm();
  const [terms, setTerms] = useState<LedgerTerm[]>([]);
  const [termId, setTermId] = useState('');
  const [grid, setGrid] = useState<ClassTimetableGrid | null>(null);
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const teacherId = user?.teacherId ? parseInt(String(user.teacherId), 10) : null;

  useEffect(() => { void fetchLedgerTerms().then(setTerms); }, []);
  useEffect(() => { if (activeLedgerTermId && !termId) setTermId(String(activeLedgerTermId)); }, [activeLedgerTermId, termId]);

  const load = useCallback(async () => {
    const tid = parseInt(termId, 10);
    if (!teacherId || !Number.isInteger(tid)) {
      setGrid(null);
      setExams([]);
      return;
    }
    setLoading(true);
    try {
      const [classData, examData] = await Promise.all([
        fetchTeacherTimetable(teacherId, tid),
        fetchTeacherExams(teacherId, tid),
      ]);
      setGrid(classData);
      setExams(examData.exams);
    } catch (e: unknown) {
      toast({ title: 'Could not load schedule', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [teacherId, termId]);

  useEffect(() => { void load(); }, [load]);

  const nextClass = useMemo(() => (grid ? findNextClassToday(grid) : null), [grid]);
  const slotCount = grid?.slots.length ?? 0;
  const periodCount = grid?.periods.length ?? 0;

  if (!teacherId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
        Your account is not linked to a teacher profile.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className={`${timetableCardClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">My teaching schedule</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">
              {user?.fullName || user?.username || 'Teacher'}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Only your assigned periods appear here. You&apos;ll get a notification 5 minutes before each class.
            </p>
          </div>
          <div className="max-w-xs w-full">
            <label className={timetableLabelClass}>Term</label>
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className={timetableNativeSelectClass}>
              <option value="">Select term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {nextClass ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/30">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white dark:bg-emerald-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {nextClass.minutesUntil <= 0 ? 'Class now' : nextClass.minutesUntil <= 5 ? 'Starting very soon' : 'Up next today'}
                </p>
                <p className="mt-0.5 text-base font-bold text-slate-900 dark:text-slate-100">
                  {nextClass.subject_name} · {nextClass.class_name}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {nextClass.period_name} · {formatTimeRangeCompact(nextClass.start_time, nextClass.end_time)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
              <Bell className="h-4 w-4" />
              {nextClass.minutesUntil <= 0
                ? 'Your class is in progress'
                : `Starts in about ${nextClass.minutesUntil} min`}
            </div>
          </div>
        </div>
      ) : null}

      <Tabs defaultValue="class">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className={timetableTabsListClass}>
            <TabsTrigger value="class" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
              Class schedule
            </TabsTrigger>
            <TabsTrigger value="exam" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
              Exam schedule
            </TabsTrigger>
          </TabsList>
          {grid ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="rounded-lg dark:bg-slate-800 dark:text-slate-200">{periodCount} periods</Badge>
              <Badge variant="outline" className="rounded-lg dark:border-slate-600 dark:text-slate-300">{slotCount} lessons</Badge>
            </div>
          ) : null}
        </div>

        <TabsContent value="class" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading your schedule…
            </div>
          ) : !termId ? (
            <div className={timetableEmptyStateClass}>
              <CalendarDays className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">Select a term</p>
            </div>
          ) : grid && grid.slots.length === 0 ? (
            <div className={timetableEmptyStateClass}>
              <CalendarDays className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">No lessons assigned yet</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                When admin adds you to the class timetable, your periods will show here automatically.
              </p>
            </div>
          ) : grid ? (
            <div className={`overflow-hidden ${timetableMutedPanelClass}`}>
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Your periods only</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Columns match the time slots where you teach this term.</p>
              </div>
              <div className="p-3 sm:p-4">
                <TimetableGrid grid={grid} mode="teacher" embedded />
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="exam" className="mt-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            </div>
          ) : exams.length === 0 ? (
            <div className={`${timetableEmptyStateClass} text-sm text-slate-500 dark:text-slate-400`}>
              No upcoming exams for your subjects.
            </div>
          ) : (
            exams.map((exam) => (
              <div
                key={exam.id}
                className={`rounded-2xl border border-slate-200 bg-white p-4 border-l-4 dark:border-slate-700 dark:bg-slate-900/80 ${classAccentColor(exam.class_id)}`}
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{formatExamDate(exam.exam_date)}</p>
                <p className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">{exam.subject_name}</p>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{formatTimeRange(exam.start_time, exam.end_time)}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{[exam.class_name, exam.venue].filter(Boolean).join(' · ')}</p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
