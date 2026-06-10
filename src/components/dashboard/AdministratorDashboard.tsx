import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useData, type Student } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  AlertCircle,
  Eye,
  LayoutGrid,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';
import { calculateStudentFeesSync, calculateStudentFeeStatusSync } from '../../utils/feeCalculations';
import { cn } from '@/lib/utils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = {
  paid: '#10b981',
  owing: '#ef4444',
  noFee: '#94a3b8',
  credit: '#3b82f6',
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

function feeStatusForDashboard(sync: ReturnType<typeof calculateStudentFeeStatusSync>) {
  if (sync.status === 'Paid') return { status: 'Fully Paid' as const, balance: 0 };
  if (sync.status === 'Credit Balance') return { status: 'Credit Balance' as const, balance: sync.balance };
  if (sync.status === 'No Fee Set') return { status: 'No Fee Set' as const, balance: 0 };
  return { status: 'Amount Owing' as const, balance: sync.balance };
}

type StudentWithFee = Student & {
  feeStatus: ReturnType<typeof feeStatusForDashboard>;
};

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
      <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/50" aria-hidden />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

const AdministratorDashboard = () => {
  const { students, teachers, classes, payments, feeStructures, arrearsBalances, loading, workspaceReady, refresh } = useData();
  const { currentTerm: activeAcademicTerm, currentYear: activeAcademicYear, isLoading: termLoading, refresh: refreshTerm } = useActiveTerm();
  const [selectedClass, setSelectedClass] = useState('all-classes');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshTerm()]);
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshTerm]);

  const dataLoading = loading || !workspaceReady;

  const totalStudents = students.length;
  const maleStudents = students.filter((s) => s.gender === 'Male').length;
  const femaleStudents = students.filter((s) => s.gender === 'Female').length;
  const otherGenderStudents = Math.max(0, totalStudents - maleStudents - femaleStudents);

  const totalTeachers = teachers.length;
  const maleTeachers = teachers.filter((t) => t.gender === 'Male').length;
  const femaleTeachers = teachers.filter((t) => t.gender === 'Female').length;

  const activeClasses = classes.filter((cls) => cls.className && cls.className.trim() !== '').length;

  const filteredStudents = useMemo(
    () =>
      selectedClass === 'all-classes'
        ? students
        : students.filter((student) => student.classAssigned === selectedClass),
    [students, selectedClass]
  );

  const studentsWithFeeStatus: StudentWithFee[] = useMemo(() => {
    const term = activeAcademicTerm?.trim() || '';
    if (!term || term === 'Not Set') {
      return filteredStudents.map((student) => ({
        ...student,
        feeStatus: { status: 'No Fee Set' as const, balance: 0 },
      }));
    }
    return filteredStudents.map((student) => {
      const feeCalc = calculateStudentFeesSync(
        student.id,
        term,
        student.classAssigned,
        feeStructures,
        payments,
        student.classAssignedId,
        arrearsBalances,
        {
          isBeneficiary: !!student.isBeneficiary,
          discountType: student.discountType,
          discountValue: student.discountValue,
        }
      );
      const sync = calculateStudentFeeStatusSync(feeCalc);
      return { ...student, feeStatus: feeStatusForDashboard(sync) };
    });
  }, [filteredStudents, activeAcademicTerm, feeStructures, payments, arrearsBalances]);

  const feeCounts = useMemo(() => {
    let paid = 0;
    let owing = 0;
    let noFee = 0;
    let credit = 0;
    for (const s of studentsWithFeeStatus) {
      if (s.feeStatus.status === 'Fully Paid') paid++;
      else if (s.feeStatus.status === 'Amount Owing') owing++;
      else if (s.feeStatus.status === 'No Fee Set') noFee++;
      else if (s.feeStatus.status === 'Credit Balance') credit++;
    }
    return { paid, owing, noFee, credit };
  }, [studentsWithFeeStatus]);

  const totalOwing = studentsWithFeeStatus
    .filter((s) => s.feeStatus.status === 'Amount Owing')
    .reduce((sum, s) => sum + s.feeStatus.balance, 0);

  const pieData = useMemo(
    () =>
      [
        { name: 'Fully paid', value: feeCounts.paid, key: 'paid' },
        { name: 'Amount owing', value: feeCounts.owing, key: 'owing' },
        { name: 'No fee set', value: feeCounts.noFee, key: 'noFee' },
        { name: 'Credit balance', value: feeCounts.credit, key: 'credit' },
      ].filter((d) => d.value > 0),
    [feeCounts]
  );

  const enrollmentByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of students) {
      const c = (s.classAssigned || 'Unassigned').trim() || 'Unassigned';
      map.set(c, (map.get(c) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([fullName, count]) => ({
        name: fullName.length > 14 ? `${fullName.slice(0, 12)}…` : fullName,
        fullName,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 14);
  }, [students]);

  const searchLower = search.trim().toLowerCase();
  const displayedStudents = useMemo(() => {
    if (!searchLower) return studentsWithFeeStatus;
    return studentsWithFeeStatus.filter((s) => {
      const name = `${s.firstName} ${s.lastName}`.toLowerCase();
      const id = (s.studentId || '').toLowerCase();
      const adm = (s.admissionNumber || '').toLowerCase();
      return name.includes(searchLower) || id.includes(searchLower) || adm.includes(searchLower);
    });
  }, [studentsWithFeeStatus, searchLower]);

  const kpiCards = [
    {
      key: 'students',
      label: 'Students',
      value: dataLoading ? null : totalStudents,
      sub: dataLoading ? '' : `${maleStudents} male · ${femaleStudents} female${otherGenderStudents ? ` · ${otherGenderStudents} other` : ''}`,
      icon: Users,
      ring: 'ring-sky-500/20',
      bg: 'from-sky-500/12 via-card to-card',
    },
    {
      key: 'teachers',
      label: 'Teachers',
      value: dataLoading ? null : totalTeachers,
      sub: dataLoading ? '' : `${maleTeachers} male · ${femaleTeachers} female`,
      icon: BookOpen,
      ring: 'ring-emerald-500/20',
      bg: 'from-emerald-500/12 via-card to-card',
    },
    {
      key: 'classes',
      label: 'Classes',
      value: dataLoading ? null : activeClasses,
      sub: dataLoading ? '' : 'Configured in academic setup',
      icon: GraduationCap,
      ring: 'ring-violet-500/20',
      bg: 'from-violet-500/12 via-card to-card',
    },
    {
      key: 'fees',
      label: 'Fee health',
      value: dataLoading ? null : feeCounts.paid,
      sub: dataLoading
        ? ''
        : `${feeCounts.owing} owing · ${feeCounts.noFee} no fee · ${feeCounts.credit} credit`,
      icon: DollarSign,
      ring: 'ring-amber-500/25',
      bg: 'from-amber-500/10 via-card to-card',
    },
  ];

  return (
    <div className="relative min-h-full overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_45%_at_20%_-10%,hsl(var(--primary)/0.1),transparent)] dark:bg-[radial-gradient(ellipse_75%_45%_at_20%_-10%,hsl(var(--primary)/0.16),transparent)]" />

      <div className="relative space-y-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <LayoutGrid className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Administrator dashboard</h1>
              <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                Live enrollment and fee status for the active term. Data refreshes when the workspace loads and when school records change.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {termLoading ? 'Loading term…' : `Term: ${activeAcademicTerm}`}
                </Badge>
                <Badge variant="outline" className="font-normal">
                  Year: {activeAcademicYear}
                </Badge>
                {dataLoading && (
                  <Badge variant="outline" className="h-6 w-6 rounded-full p-0">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 gap-2 self-start shadow-sm"
            onClick={() => void handleRefreshAll()}
            disabled={refreshing || dataLoading}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {kpiCards.map((k) => (
            <Card
              key={k.key}
              className={cn(
                'overflow-hidden border-border/80 bg-gradient-to-br shadow-md ring-1 ring-black/5 dark:ring-white/5',
                k.bg,
                k.ring
              )}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4">
                <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k.label}</CardTitle>
                <k.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pb-4">
                {dataLoading ? (
                  <Skeleton className="h-9 w-24" />
                ) : (
                  <div className="text-2xl font-bold tabular-nums tracking-tight text-foreground md:text-3xl">{k.value}</div>
                )}
                <p className="mt-1 min-h-[2.5rem] text-xs leading-relaxed text-muted-foreground">{dataLoading ? <Skeleton className="mt-1 h-3 w-full max-w-[200px]" /> : k.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {!dataLoading && totalStudents === 0 && (
          <EmptyState
            title="No students yet"
            hint="Add students under Academic → Students. Metrics and charts will appear automatically."
          />
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <Card className="overflow-hidden border-border/80 shadow-md">
            <CardHeader className="border-b border-border/60 bg-muted/30">
              <CardTitle className="text-lg">Fee status mix</CardTitle>
              <CardDescription>
                {selectedClass === 'all-classes' ? 'All students in scope' : `Class: ${selectedClass}`} · Term{' '}
                {activeAcademicTerm}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {dataLoading ? (
                <Skeleton className="h-[280px] w-full rounded-lg" />
              ) : pieData.length === 0 ? (
                <EmptyState title="Nothing to chart" hint="No students in the current filter, or term is not set in school settings." />
              ) : (
                <div className="h-[min(300px,38vh)] w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={88}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.key}
                            fill={
                              entry.key === 'paid'
                                ? CHART_COLORS.paid
                                : entry.key === 'owing'
                                  ? CHART_COLORS.owing
                                  : entry.key === 'noFee'
                                    ? CHART_COLORS.noFee
                                    : CHART_COLORS.credit
                            }
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `${v} students`} contentStyle={tooltipStyle} />
                      <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/80 shadow-md">
            <CardHeader className="border-b border-border/60 bg-muted/30">
              <CardTitle className="text-lg">Enrollment by class</CardTitle>
              <CardDescription>Student headcount per class (school-wide)</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {dataLoading ? (
                <Skeleton className="h-[280px] w-full rounded-lg" />
              ) : enrollmentByClass.length === 0 ? (
                <EmptyState title="No class assignments" hint="Assign classes to students to see this chart." />
              ) : (
                <div className="h-[min(300px,38vh)] w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={enrollmentByClass} layout="vertical" margin={{ left: 4, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={96}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        formatter={(v: number) => [`${v} students`, 'Count']}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload as { fullName?: string })?.fullName ?? ''}
                        contentStyle={tooltipStyle}
                      />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]} barSize={18} name="Students" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden border-border/80 shadow-md">
          <CardHeader className="border-b border-border/60 bg-muted/30">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">Student fee status</CardTitle>
                  <CardDescription>
                    Per-student status for <span className="font-medium text-foreground">{activeAcademicTerm}</span>
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name or ID…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10 pl-9"
                  />
                </div>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-10 w-full sm:w-[200px]">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-classes">All classes</SelectItem>
                    {classes
                      .filter((cls) => cls.className && cls.className.trim() !== '')
                      .map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {!dataLoading && totalOwing > 0 && (
                  <Badge variant="destructive" className="h-10 shrink-0 px-3 py-0 whitespace-nowrap">
                    Total owing GHS {totalOwing.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {dataLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : displayedStudents.length === 0 ? (
              <EmptyState
                title={studentsWithFeeStatus.length === 0 ? 'No students in this class' : 'No matches'}
                hint={
                  studentsWithFeeStatus.length === 0
                    ? 'Try “All classes” or pick another class from the filter.'
                    : 'Clear the search or try another name or student ID.'
                }
              />
            ) : (
              <>
                <p className="mb-3 text-xs text-muted-foreground">
                  Showing {displayedStudents.length} of {studentsWithFeeStatus.length} in this view
                </p>
                <ScrollArea className="h-[min(520px,55vh)] pr-3">
                  <div className="space-y-2">
                    {displayedStudents.map((student) => (
                      <div
                        key={student.id}
                        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card/50 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-foreground">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span>{student.classAssigned || '—'}</span>
                            <span className="text-border">·</span>
                            <span className="font-mono">ID {student.studentId}</span>
                            {student.enrollmentStatus && (
                              <>
                                <span className="text-border">·</span>
                                <span className="capitalize">{student.enrollmentStatus}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                          {student.feeStatus.status === 'Amount Owing' && (
                            <div className="text-right">
                              <Badge variant="destructive" className="mb-1 gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Owing
                              </Badge>
                              <div className="font-mono text-sm font-semibold text-destructive">
                                GHS {student.feeStatus.balance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                              </div>
                            </div>
                          )}
                          {student.feeStatus.status === 'Fully Paid' && (
                            <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600">Fully paid</Badge>
                          )}
                          {student.feeStatus.status === 'Credit Balance' && (
                            <div className="text-right">
                              <Badge className="mb-1 border-0 bg-sky-600 text-white hover:bg-sky-600">Credit</Badge>
                              <div className="font-mono text-sm font-semibold text-sky-600 dark:text-sky-400">
                                GHS {Math.abs(student.feeStatus.balance).toLocaleString()}
                              </div>
                            </div>
                          )}
                          {student.feeStatus.status === 'No Fee Set' && (
                            <Badge variant="outline" className="text-muted-foreground">
                              No fee set
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </CardContent>
        </Card>

        <Separator className="opacity-50" />
        <p className="text-center text-[11px] text-muted-foreground">
          Fee amounts use the same rules as Fees &amp; Payments — including beneficiaries and arrears when configured.
        </p>
      </div>
    </div>
  );
};

export default AdministratorDashboard;
