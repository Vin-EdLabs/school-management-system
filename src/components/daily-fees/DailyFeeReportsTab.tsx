import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useActiveTerm } from '@/hooks/useActiveTerm';
import {
  fetchClassOverviewReport,
  fetchStudentDailyFeeReport,
  type ClassOverviewReport,
  type StudentDailyFeeReport,
} from '@/services/dailyFeeReportsApi';
import DailyFeeClassOverview from './reports/DailyFeeClassOverview';
import DailyFeeStudentReport from './reports/DailyFeeStudentReport';

type AcademicTerm = { id: number; term_name: string; year: string; is_active: boolean };
type DailyClass = { id: number; class_name: string; structure_id?: number };

type ViewLevel = 'overview' | 'student';

type Props = { disabled?: boolean; listKey?: number };

const DailyFeeReportsTab: React.FC<Props> = ({ disabled, listKey = 0 }) => {
  const { activeAcademicTermId } = useActiveTerm();
  const [terms, setTerms] = useState<AcademicTerm[]>([]);
  const [dailyClasses, setDailyClasses] = useState<DailyClass[]>([]);
  const [termId, setTermId] = useState('');
  const [classId, setClassId] = useState('');
  const [view, setView] = useState<ViewLevel>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [sortKey, setSortKey] = useState<'totalPaid' | 'lastPayment'>('totalPaid');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<ClassOverviewReport | null>(null);
  const [studentData, setStudentData] = useState<StudentDailyFeeReport | null>(null);

  useEffect(() => {
    void apiService
      .get<AcademicTerm[]>('/settings/academic-terms')
      .then((rows) => setTerms(Array.isArray(rows) ? rows : []))
      .catch(() => setTerms([]));
  }, [listKey]);

  useEffect(() => {
    void apiService
      .get<DailyClass[]>('/daily-fees/classes')
      .then((rows) => {
        const list = (Array.isArray(rows) ? rows : []).filter((c) => c.structure_id != null);
        setDailyClasses(list);
        if (list.length === 1 && !classId) setClassId(String(list[0].id));
      })
      .catch(() => setDailyClasses([]));
  }, [listKey, classId]);

  useEffect(() => {
    if (termId) return;
    const active = terms.find((t) => t.is_active);
    if (active) setTermId(String(active.id));
    else if (activeAcademicTermId) setTermId(String(activeAcademicTermId));
  }, [terms, activeAcademicTermId, termId]);

  const loadOverview = useCallback(async () => {
    if (!classId || !termId || disabled) {
      setOverviewData(null);
      return;
    }
    setOverviewLoading(true);
    try {
      const data = await fetchClassOverviewReport(parseInt(classId, 10), parseInt(termId, 10));
      setOverviewData(data);
    } catch (err: any) {
      setOverviewData(null);
      toast({ title: 'Failed to load report', description: err?.message, variant: 'destructive' });
    } finally {
      setOverviewLoading(false);
    }
  }, [classId, termId, disabled]);

  const loadStudent = useCallback(
    async (studentId: number) => {
      if (!termId || disabled) return;
      setStudentLoading(true);
      try {
        const data = await fetchStudentDailyFeeReport(studentId, parseInt(termId, 10));
        setStudentData(data);
      } catch (err: any) {
        setStudentData(null);
        toast({ title: 'Failed to load student report', description: err?.message, variant: 'destructive' });
      } finally {
        setStudentLoading(false);
      }
    },
    [termId, disabled]
  );

  useEffect(() => {
    if (view === 'overview') void loadOverview();
  }, [view, loadOverview]);

  useEffect(() => {
    if (view === 'student' && selectedStudentId != null) void loadStudent(selectedStudentId);
  }, [view, selectedStudentId, loadStudent]);

  const studentQuickMatches = useMemo(() => {
    if (!overviewData || !studentSearch.trim()) return [];
    const q = studentSearch.toLowerCase();
    return overviewData.students
      .filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          String(s.admissionNumber || '').toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [overviewData, studentSearch]);

  const goToStudent = (studentId: number) => {
    setSelectedStudentId(studentId);
    setView('student');
    setStudentSearch('');
  };

  const handleSort = (key: 'totalPaid' | 'lastPayment') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const termLabel = terms.find((t) => String(t.id) === termId);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-slate-200/80 shadow-sm">
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={termId} onValueChange={setTermId} disabled={disabled}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.term_name} {t.year}
                    {t.is_active ? ' (Active)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Class (daily fee)</Label>
            <Select value={classId} onValueChange={setClassId} disabled={disabled}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {dailyClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.class_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Find student report</Label>
            <div className="relative">
              <Input
                placeholder="Search student by name or ID…"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="rounded-xl"
                disabled={disabled || !classId}
              />
              {studentQuickMatches.length > 0 && view === 'overview' ? (
                <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg dark:bg-slate-900">
                  {studentQuickMatches.map((s) => (
                    <button
                      key={s.studentId}
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={() => goToStudent(s.studentId)}
                    >
                      {s.studentName}
                      <span className="ml-2 text-slate-500">{s.studentCode}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {view === 'overview' ? (
        <DailyFeeClassOverview
          data={overviewData}
          loading={overviewLoading || disabled}
          search={tableSearch}
          onSearchChange={setTableSearch}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          onViewStudent={goToStudent}
        />
      ) : (
        <DailyFeeStudentReport
          data={studentData}
          loading={studentLoading}
          onBack={() => {
            setView('overview');
            setSelectedStudentId(null);
            setStudentData(null);
          }}
        />
      )}

      {termLabel && classId && view === 'overview' && overviewData ? (
        <p className="text-center text-xs text-slate-400">
          Reporting for {overviewData.class.name} · {overviewData.term.label}
        </p>
      ) : null}
    </div>
  );
};

export default DailyFeeReportsTab;
