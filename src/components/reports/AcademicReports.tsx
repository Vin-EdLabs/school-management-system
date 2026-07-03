import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  BookOpen,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
  Search,
  Shield,
  GraduationCap,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiService } from '@/services/api';
import { useTermStatus } from '@/contexts/TermStatusContext';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { toast } from '@/hooks/use-toast';
import { inferTermBounds, normalizeDateOnly } from '@/utils/inferTermBounds';
import { formatDisplayDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { useSocket } from '@/contexts/SocketContext';

interface AdmissionsByMonth {
  month: string;
  count: number;
  fullMonth: string;
}

interface TermData {
  term: string;
  enrolled?: number;
  admissions?: number;
  leavers?: number;
}

interface GenderData {
  name: string;
  value: number;
}

type DetailTab = 'leavers' | 'admitted' | 'teachers' | 'completed';

function monthsInTermRange(termStart: string, termEnd: string): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [{ value: 'all', label: 'All months in term' }];
  const start = new Date(`${termStart}T12:00:00`);
  const end = new Date(`${termEnd}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return options;

  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth() + 1;
    const value = `${y}-${String(m).padStart(2, '0')}`;
    const label = cursor.toLocaleString('en-GH', { month: 'long', year: 'numeric' });
    options.push({ value, label });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
}

const AcademicReports: React.FC = () => {
  const { setViewingTermLabel } = useTermStatus();
  const { socket } = useSocket();

  const [academicTerms, setAcademicTerms] = useState<any[]>([]);
  const [activeYearKey, setActiveYearKey] = useState('');
  const [activeTerm, setActiveTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [detailTab, setDetailTab] = useState<DetailTab>('leavers');
  const [periodReady, setPeriodReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [admissionsCount, setAdmissionsCount] = useState(0);
  const [teachersAppointed, setTeachersAppointed] = useState(0);
  const [studentsLeft, setStudentsLeft] = useState(0);
  const [studentsCompleted, setStudentsCompleted] = useState(0);
  const [maleLeavers, setMaleLeavers] = useState(0);
  const [adminsCount, setAdminsCount] = useState(0);
  const [enrollmentAtStart, setEnrollmentAtStart] = useState(0);

  const [admissionsByMonth, setAdmissionsByMonth] = useState<AdmissionsByMonth[]>([]);
  const [leaversByMonth, setLeaversByMonth] = useState<AdmissionsByMonth[]>([]);
  const [enrollmentTrend, setEnrollmentTrend] = useState<TermData[]>([]);
  const [genderSplit, setGenderSplit] = useState<GenderData[]>([]);
  const [termComparison, setTermComparison] = useState<TermData[]>([]);
  const [detailRows, setDetailRows] = useState<any[]>([]);

  const termWindow = useMemo(() => {
    if (!activeTerm || !activeYearKey) return null;
    const selectedTerm = academicTerms.find(
      (t) => t.term_name === activeTerm && t.year === activeYearKey
    );
    const inferred = inferTermBounds(activeTerm, activeYearKey);
    return {
      termStart: normalizeDateOnly(selectedTerm?.start_date) || inferred.start,
      termEnd: normalizeDateOnly(selectedTerm?.end_date) || inferred.end,
      termId: selectedTerm?.id ?? null,
    };
  }, [academicTerms, activeTerm, activeYearKey]);

  const monthOptions = useMemo(
    () => (termWindow ? monthsInTermRange(termWindow.termStart, termWindow.termEnd) : [{ value: 'all', label: 'All months in term' }]),
    [termWindow]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiService.get('/settings'),
      apiService.get<any[]>('/settings/academic-terms').catch(() => []),
    ])
      .then(([s, termsRaw]) => {
        if (cancelled) return;
        const list = (Array.isArray(termsRaw) ? termsRaw : []).map((t: any) => ({
          id: Number(t.id),
          term_name: String(t.term_name || '').trim(),
          year: String(t.year || '').trim(),
          start_date: t.start_date,
          end_date: t.end_date,
          is_active: !!t.is_active,
        }));
        setAcademicTerms(list);

        const cy = String(s?.current_year ?? '').trim();
        const yearSet = [...new Set(list.map((x) => x.year).filter(Boolean))].sort((a, b) =>
          a.localeCompare(b)
        );
        const yearKeys = yearSet.length ? yearSet : cy ? [cy] : [String(new Date().getFullYear())];
        const pickYear = cy && yearKeys.includes(cy) ? cy : yearKeys[0];
        setActiveYearKey(pickYear);

        const termsForYear = list
          .filter((t) => t.year === pickYear)
          .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
        const active = termsForYear.find((t) => t.is_active) || termsForYear[0];
        setActiveTerm(active?.term_name || 'Term 1');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPeriodReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (periodReady && activeTerm && activeYearKey) {
      setViewingTermLabel(`${activeTerm} ${activeYearKey}`);
    }
  }, [periodReady, activeTerm, activeYearKey, setViewingTermLabel]);

  useEffect(() => () => setViewingTermLabel(null), [setViewingTermLabel]);

  useEffect(() => {
    setFilterMonth('all');
  }, [activeTerm, activeYearKey]);

  const buildParams = useCallback(() => {
    if (!termWindow) return '';
    const params = new URLSearchParams({
      termStart: termWindow.termStart,
      termEnd: termWindow.termEnd,
      termName: activeTerm,
      year: activeYearKey,
      month: filterMonth,
    });
    if (termWindow.termId) params.set('termId', String(termWindow.termId));
    if (appliedSearch.trim()) params.set('search', appliedSearch.trim());
    return params.toString();
  }, [termWindow, activeTerm, activeYearKey, filterMonth, appliedSearch]);

  const fetchSummary = useCallback(async () => {
    if (!periodReady || !termWindow) {
      setLoading(false);
      return;
    }

    const paramStr = new URLSearchParams({
      termStart: termWindow.termStart,
      termEnd: termWindow.termEnd,
      termName: activeTerm,
      year: activeYearKey,
      month: filterMonth,
    });
    if (termWindow.termId) paramStr.set('termId', String(termWindow.termId));

    setLoading(true);
    setLoadError(null);
    try {
      const results = await Promise.allSettled([
        apiService.get<{ count: number }>(`/reports/academic/admissions-count?${paramStr}`),
        apiService.get<{ count: number }>(`/reports/academic/teachers-appointed?${paramStr}`),
        apiService.get<{ count: number }>(`/reports/academic/students-left?${paramStr}`),
        apiService.get<{ count: number }>(`/reports/academic/students-completed?${paramStr}`),
        apiService.get<{ count: number }>(`/reports/academic/male-leavers?${paramStr}`),
        apiService.get<{ count: number }>(`/reports/academic/admins-count`),
        apiService.get<{ count: number }>(
          `/reports/academic/enrollment-at-start?termStart=${termWindow.termStart}&termName=${encodeURIComponent(activeTerm)}&year=${encodeURIComponent(activeYearKey)}`
        ),
        apiService.get<AdmissionsByMonth[]>(`/reports/academic/admissions-by-month?${paramStr}`),
        apiService.get<AdmissionsByMonth[]>(`/reports/academic/leavers-by-month?${paramStr}`),
        apiService.get<TermData[]>(`/reports/academic/enrollment-trend`),
        apiService.get<GenderData[]>(`/reports/academic/gender-split-leavers?${paramStr}`),
        apiService.get<TermData[]>(`/reports/academic/term-comparison`),
      ]);

      const val = <T,>(i: number, fallback: T): T =>
        results[i].status === 'fulfilled' ? (results[i] as PromiseFulfilledResult<T>).value : fallback;

      setAdmissionsCount(val(0, { count: 0 }).count || 0);
      setTeachersAppointed(val(1, { count: 0 }).count || 0);
      setStudentsLeft(val(2, { count: 0 }).count || 0);
      setStudentsCompleted(val(3, { count: 0 }).count || 0);
      setMaleLeavers(val(4, { count: 0 }).count || 0);
      setAdminsCount(val(5, { count: 0 }).count || 0);
      setEnrollmentAtStart(val(6, { count: 0 }).count || 0);
      setAdmissionsByMonth(Array.isArray(val(7, [])) ? val(7, []) : []);
      setLeaversByMonth(Array.isArray(val(8, [])) ? val(8, []) : []);
      setEnrollmentTrend(Array.isArray(val(9, [])) ? val(9, []) : []);
      setGenderSplit(Array.isArray(val(10, [])) ? val(10, []) : []);
      setTermComparison(Array.isArray(val(11, [])) ? val(11, []) : []);
    } catch (e: any) {
      const msg = e?.message || 'Failed to load academic report.';
      setLoadError(msg);
      toast({ title: 'Academic report failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [periodReady, termWindow, activeTerm, activeYearKey, filterMonth]);

  const fetchDetail = useCallback(async () => {
    if (!periodReady || !termWindow) return;

    const endpoints: Record<DetailTab, string> = {
      leavers: '/reports/academic/students-left-list',
      admitted: '/reports/academic/students-admitted-list',
      teachers: '/reports/academic/teachers-appointed-list',
      completed: '/reports/academic/students-completed-list',
    };

    setDetailLoading(true);
    try {
      const data = await apiService.get<any[]>(`${endpoints[detailTab]}?${buildParams()}`);
      setDetailRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error(e);
      setDetailRows([]);
      toast({
        title: 'Could not load records',
        description: e?.message || 'Try adjusting your filters.',
        variant: 'destructive',
      });
    } finally {
      setDetailLoading(false);
    }
  }, [periodReady, termWindow, detailTab, buildParams]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  useEffect(() => {
    if (!socket) return;
    const onStudentChange = (evt: { entity?: string }) => {
      if (evt?.entity === 'student') {
        void fetchSummary();
        void fetchDetail();
      }
    };
    socket.on('tenant-data-changed', onStudentChange);
    return () => {
      socket.off('tenant-data-changed', onStudentChange);
    };
  }, [socket, fetchSummary, fetchDetail]);

  const focusDetailTab = (tab: DetailTab) => {
    setDetailTab(tab);
    if (typeof document !== 'undefined') {
      document.getElementById('academic-report-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const applySearch = () => {
    setAppliedSearch(searchInput.trim());
  };

  const netGrowthRate = useMemo(() => {
    if (enrollmentAtStart === 0) return '0.0';
    const netChange = admissionsCount - studentsLeft - studentsCompleted;
    return ((netChange / enrollmentAtStart) * 100).toFixed(1);
  }, [admissionsCount, studentsLeft, studentsCompleted, enrollmentAtStart]);

  const netMovement = useMemo(
    () => admissionsCount - studentsLeft,
    [admissionsCount, studentsLeft]
  );

  const movementByMonth = useMemo(() => {
    const byMonth = new Map<string, { month: string; admissions: number; leavers: number }>();
    for (const row of admissionsByMonth) {
      byMonth.set(row.month, {
        month: row.month,
        admissions: row.count,
        leavers: byMonth.get(row.month)?.leavers ?? 0,
      });
    }
    for (const row of leaversByMonth) {
      const existing = byMonth.get(row.month);
      byMonth.set(row.month, {
        month: row.month,
        admissions: existing?.admissions ?? 0,
        leavers: row.count,
      });
    }
    return [...byMonth.values()];
  }, [admissionsByMonth, leaversByMonth]);

  const selectedTermLabel = useMemo(
    () => (activeTerm && activeYearKey ? `${activeTerm} ${activeYearKey}` : 'Selected term'),
    [activeTerm, activeYearKey]
  );

  const yearSet = useMemo(
    () => [...new Set(academicTerms.map((t) => t.year).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [academicTerms]
  );

  const termsForYear = useMemo(
    () =>
      academicTerms
        .filter((t) => t.year === activeYearKey)
        .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || ''))),
    [academicTerms, activeYearKey]
  );

  const COLORS = ['#16a34a', '#dc2626', '#f59e0b', '#0ea5e9', '#8b5cf6', '#ec4899'];

  const tabMeta: { id: DetailTab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'leavers', label: 'Students left', icon: <UserMinus className="h-4 w-4" />, count: studentsLeft },
    { id: 'admitted', label: 'Students admitted', icon: <UserPlus className="h-4 w-4" />, count: admissionsCount },
    { id: 'teachers', label: 'Teachers appointed', icon: <BookOpen className="h-4 w-4" />, count: teachersAppointed },
    { id: 'completed', label: 'Students completed', icon: <GraduationCap className="h-4 w-4" />, count: studentsCompleted },
  ];

  if (!periodReady) {
    return <BrandedLoading />;
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 animate-in fade-in duration-500 bg-slate-50/80 min-h-screen">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Academic Report</h1>
          <p className="mt-1 text-sm text-slate-500">
            Track admissions and students marked inactive per term. Counts update when you change a student&apos;s status in the registry.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 rounded-xl shrink-0"
          onClick={() => {
            void fetchSummary();
            void fetchDetail();
          }}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Filters</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Academic year</label>
            <Select
              value={activeYearKey}
              onValueChange={(year) => {
                setActiveYearKey(year);
                const nextTerms = academicTerms
                  .filter((t) => t.year === year)
                  .sort((a, b) => String(a.start_date || '').localeCompare(String(b.start_date || '')));
                if (nextTerms[0]) setActiveTerm(nextTerms[0].term_name);
              }}
            >
              <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(yearSet.length ? yearSet : [activeYearKey]).map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}/{parseInt(year, 10) + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Term</label>
            <Select value={activeTerm} onValueChange={setActiveTerm}>
              <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(termsForYear.length ? termsForYear : [{ id: 0, term_name: activeTerm }]).map((term) => (
                  <SelectItem key={term.id ?? term.term_name} value={term.term_name}>
                    {term.term_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Month</label>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="h-9 rounded-lg"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Search name or ID</label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                  placeholder="Student name, ID, teacher name…"
                  className="pl-9 h-9 rounded-lg"
                />
              </div>
              <Button type="button" variant="primaryAction" size="sm" className="h-9 rounded-lg shrink-0" onClick={applySearch}>
                Search
              </Button>
            </div>
          </div>
        </div>
        {termWindow && (
          <p className="text-[11px] text-slate-500">
            Period: {formatDisplayDate(termWindow.termStart)} — {formatDisplayDate(termWindow.termEnd)}
            {filterMonth !== 'all' && ` · Month filter active`}
            {appliedSearch && ` · Searching “${appliedSearch}”`}
          </p>
        )}
      </div>

      {academicTerms.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>Add academic terms with dates in Settings for accurate reporting.</p>
        </div>
      )}

      {loadError && !loading && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex gap-2 items-start">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{loadError}</p>
        </div>
      )}

      {loading ? (
        <BrandedLoading />
      ) : (
        <>
          {/* Term movement summary */}
          <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Term movement</p>
                <h2 className="text-lg font-semibold text-slate-900">{selectedTermLabel}</h2>
                <p className="text-xs text-slate-500">
                  Students admitted vs marked inactive for this term — click a card below to view the list
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="rounded-lg bg-white/80">
                  Enrollment at start: {enrollmentAtStart}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    'rounded-lg bg-white/80',
                    netMovement >= 0 ? 'text-emerald-700 border-emerald-200' : 'text-rose-700 border-rose-200'
                  )}
                >
                  Net movement: {netMovement >= 0 ? '+' : ''}{netMovement}
                </Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => focusDetailTab('admitted')}
                className="rounded-lg border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <div className="flex items-center gap-2 text-emerald-700">
                  <UserPlus className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Admitted</span>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-900">{admissionsCount}</p>
                <p className="mt-1 text-[11px] text-emerald-700/80">View admitted students</p>
              </button>
              <button
                type="button"
                onClick={() => focusDetailTab('leavers')}
                className="rounded-lg border border-rose-100 bg-rose-50/80 px-4 py-3 text-left transition hover:border-rose-200 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <div className="flex items-center gap-2 text-rose-700">
                  <UserMinus className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Left (inactive)</span>
                </div>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-rose-900">{studentsLeft}</p>
                <p className="mt-1 text-[11px] text-rose-700/80">View students who left</p>
              </button>
              <div className="rounded-lg border border-sky-100 bg-sky-50/80 px-4 py-3">
                <div className="flex items-center gap-2 text-sky-700">
                  {netMovement >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  <span className="text-xs font-medium uppercase tracking-wide">Net change</span>
                </div>
                <p className={cn('mt-1 text-2xl font-semibold tabular-nums', netMovement >= 0 ? 'text-emerald-900' : 'text-rose-900')}>
                  {netMovement >= 0 ? '+' : ''}{netMovement}
                </p>
              </div>
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
            <KpiCard label="Admitted" value={admissionsCount} icon={<UserPlus className="w-4 h-4" />} accent="sky" onClick={() => focusDetailTab('admitted')} />
            <KpiCard label="Teachers" value={teachersAppointed} icon={<BookOpen className="w-4 h-4" />} accent="indigo" onClick={() => focusDetailTab('teachers')} />
            <KpiCard label="Left school" value={studentsLeft} icon={<UserMinus className="w-4 h-4" />} accent="rose" onClick={() => focusDetailTab('leavers')} />
            <KpiCard label="Completed" value={studentsCompleted} icon={<GraduationCap className="w-4 h-4" />} accent="emerald" onClick={() => focusDetailTab('completed')} />
            <KpiCard label="Male leavers" value={maleLeavers} icon={<Users className="w-4 h-4" />} accent="amber" />
            <KpiCard label="Admins" value={adminsCount} icon={<Shield className="w-4 h-4" />} accent="violet" />
            <KpiCard label="Net growth" value={`${netGrowthRate}%`} icon={parseFloat(netGrowthRate) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} accent={parseFloat(netGrowthRate) >= 0 ? 'emerald' : 'rose'} isText />
          </div>

          {/* Detail tables */}
          <div id="academic-report-detail" className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex flex-wrap gap-1 p-2 border-b border-slate-100 bg-slate-50/80">
              {tabMeta.map((tab) => (
                <Button
                  key={tab.id}
                  type="button"
                  size="sm"
                  variant={detailTab === tab.id ? 'primaryAction' : 'ghost'}
                  className="h-8 rounded-lg text-xs gap-1.5"
                  onClick={() => setDetailTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                  <Badge variant="outline" className="text-[10px] ml-0.5 px-1.5 py-0 h-4">{tab.count}</Badge>
                </Button>
              ))}
            </div>

            <div className="overflow-x-auto">
              {detailLoading ? (
                <div className="py-16 text-center text-sm text-slate-500">Loading records…</div>
              ) : detailRows.length === 0 ? (
                <div className="py-16 text-center text-sm text-slate-500 px-6">
                  {detailTab === 'leavers' ? (
                    <>
                      <p className="font-medium text-slate-700">No students marked inactive for this period.</p>
                      <p className="mt-1 text-xs">When you set a student to inactive in the registry, they will appear here for the term they left.</p>
                    </>
                  ) : detailTab === 'admitted' ? (
                    <>
                      <p className="font-medium text-slate-700">No admissions recorded for this period.</p>
                      <p className="mt-1 text-xs">New students are linked to the active academic term when added.</p>
                    </>
                  ) : (
                    <p>No records for this filter. Try another term, month, or search.</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-800 hover:bg-slate-800">
                      {detailTab === 'teachers' ? (
                        <>
                          <TableHead className="text-white font-semibold">Staff ID</TableHead>
                          <TableHead className="text-white font-semibold">Name</TableHead>
                          <TableHead className="text-white font-semibold">Class</TableHead>
                          <TableHead className="text-white font-semibold">Phone</TableHead>
                          <TableHead className="text-white font-semibold">Appointed</TableHead>
                          <TableHead className="text-white font-semibold">Status</TableHead>
                        </>
                      ) : detailTab === 'completed' ? (
                        <>
                          <TableHead className="text-white font-semibold">Student ID</TableHead>
                          <TableHead className="text-white font-semibold">Name</TableHead>
                          <TableHead className="text-white font-semibold">Gender</TableHead>
                          <TableHead className="text-white font-semibold">Class</TableHead>
                          <TableHead className="text-white font-semibold">Graduated</TableHead>
                        </>
                      ) : detailTab === 'leavers' ? (
                        <>
                          <TableHead className="text-white font-semibold">Student ID</TableHead>
                          <TableHead className="text-white font-semibold">Name</TableHead>
                          <TableHead className="text-white font-semibold">Gender</TableHead>
                          <TableHead className="text-white font-semibold">Class</TableHead>
                          <TableHead className="text-white font-semibold">Term left</TableHead>
                          <TableHead className="text-white font-semibold">Inactive date</TableHead>
                          <TableHead className="text-white font-semibold">Status</TableHead>
                        </>
                      ) : (
                        <>
                          <TableHead className="text-white font-semibold">Student ID</TableHead>
                          <TableHead className="text-white font-semibold">Name</TableHead>
                          <TableHead className="text-white font-semibold">Gender</TableHead>
                          <TableHead className="text-white font-semibold">Class</TableHead>
                          <TableHead className="text-white font-semibold">Admission term</TableHead>
                          <TableHead className="text-white font-semibold">Admitted</TableHead>
                          <TableHead className="text-white font-semibold">Status</TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-slate-50/80 even:bg-slate-50/30">
                        {detailTab === 'teachers' ? (
                          <>
                            <TableCell className="font-mono text-xs">{row.staff_id || '—'}</TableCell>
                            <TableCell className="font-medium text-sm">{row.full_name}</TableCell>
                            <TableCell className="text-sm">{row.assigned_class || '—'}</TableCell>
                            <TableCell className="text-sm">{row.phone_number || '—'}</TableCell>
                            <TableCell className="text-sm">{formatDisplayDate(row.employment_date || row.created_at)}</TableCell>
                            <TableCell><StatusBadge status={row.employment_status || 'active'} /></TableCell>
                          </>
                        ) : detailTab === 'completed' ? (
                          <>
                            <TableCell className="font-mono text-xs">{row.student_id || row.admission_number || '—'}</TableCell>
                            <TableCell className="font-medium text-sm">{row.first_name} {row.last_name}</TableCell>
                            <TableCell className="text-sm">{row.gender || '—'}</TableCell>
                            <TableCell className="text-sm">{row.class_name || '—'}</TableCell>
                            <TableCell className="text-sm">{formatDisplayDate(row.graduated_at)}</TableCell>
                          </>
                        ) : detailTab === 'leavers' ? (
                          <>
                            <TableCell className="font-mono text-xs">{row.student_id || row.admission_number || '—'}</TableCell>
                            <TableCell className="font-medium text-sm">{row.first_name} {row.last_name}</TableCell>
                            <TableCell className="text-sm">{row.gender || '—'}</TableCell>
                            <TableCell className="text-sm">{row.class_name || '—'}</TableCell>
                            <TableCell className="text-sm">{row.inactivation_term_label || selectedTermLabel}</TableCell>
                            <TableCell className="text-sm">{formatDisplayDate(row.left_date)}</TableCell>
                            <TableCell><StatusBadge status={row.enrollment_status} /></TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-mono text-xs">{row.student_id || row.admission_number || '—'}</TableCell>
                            <TableCell className="font-medium text-sm">{row.first_name} {row.last_name}</TableCell>
                            <TableCell className="text-sm">{row.gender || '—'}</TableCell>
                            <TableCell className="text-sm">{row.class_name || '—'}</TableCell>
                            <TableCell className="text-sm">{row.admission_term_label || selectedTermLabel}</TableCell>
                            <TableCell className="text-sm">{formatDisplayDate(row.date_of_admission || row.created_at)}</TableCell>
                            <TableCell><StatusBadge status={row.enrollment_status} /></TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Charts */}
          <ChartCard title={`Admissions vs inactivations by month — ${selectedTermLabel}`} className="col-span-full">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={movementByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="admissions" fill="#16a34a" name="Admissions" radius={[4, 4, 0, 0]} />
                <Bar dataKey="leavers" fill="#dc2626" name="Left (inactive)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Monthly admissions">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={admissionsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" name="Admissions" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Students left by month">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={leaversByMonth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#dc2626" name="Leavers" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Enrollment trend (last 6 terms)">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={enrollmentTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="term" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="enrolled" stroke="#3b82f6" name="Enrolled" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Admissions vs leavers (last 4 terms)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={termComparison}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="term" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="admissions" fill="#16a34a" name="Admissions" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="leavers" fill="#dc2626" name="Leavers" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Gender split — students who left">
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={genderSplit.length ? genderSplit : [{ name: 'No data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => (genderSplit.length ? `${name}: ${value}` : name)}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {(genderSplit.length ? genderSplit : [{ name: 'No data', value: 1 }]).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={genderSplit.length ? COLORS[index % COLORS.length] : '#e2e8f0'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
};

const accentMap = {
  sky: 'bg-sky-50 text-sky-700 border-sky-100',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  rose: 'bg-rose-50 text-rose-700 border-rose-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  violet: 'bg-violet-50 text-violet-700 border-violet-100',
};

function KpiCard({
  label,
  value,
  icon,
  accent = 'sky',
  isText = false,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: keyof typeof accentMap;
  isText?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-slate-200 bg-white p-4 shadow-sm text-left w-full',
        onClick && 'transition hover:border-slate-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 truncate">{label}</p>
          <p className={`${isText ? 'text-xl' : 'text-2xl'} font-bold text-slate-900 mt-1 tabular-nums`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg border shrink-0 ${accentMap[accent]}`}>{icon}</div>
      </div>
    </Wrapper>
  );
}

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white shadow-sm p-5', className)}>
      <h3 className="text-sm font-semibold text-slate-800 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const s = String(status || 'active').toLowerCase();
  const cls =
    s === 'active'
      ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
      : s === 'inactive' || s === 'withdrawn'
        ? 'text-rose-700 border-rose-200 bg-rose-50'
        : s === 'graduated'
          ? 'text-violet-700 border-violet-200 bg-violet-50'
          : s === 'pending'
            ? 'text-amber-700 border-amber-200 bg-amber-50'
            : 'text-slate-600 border-slate-200 bg-slate-50';
  const label =
    s === 'inactive' ? 'Inactive' : s === 'withdrawn' ? 'Withdrawn' : status || 'Active';
  return (
    <Badge variant="outline" className={`text-[10px] capitalize ${cls}`}>
      {label}
    </Badge>
  );
}

export default AcademicReports;
