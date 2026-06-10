import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '@/services/api';
import { useSchool } from '@/contexts/SchoolContext';
import { useData } from '@/contexts/DataContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  GraduationCap,
  Loader2,
  School,
  TrendingUp,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type AcademicYear = {
  id: number;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  is_current: boolean;
};

type PreviewStudent = {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  studentCode: string;
  action: 'graduate' | 'promote' | 'repeat';
  fromClassName: string;
  toClassName?: string;
};

type PreviewClass = {
  classId: number;
  className: string;
  isFinalClass: boolean;
  studentCount: number;
  actions: PreviewStudent[];
};

type YearEndPreview = {
  currentYearId: number;
  currentYearName: string;
  classes: PreviewClass[];
  summary: { graduate: number; promote: number; repeat: number };
};

const STEPS = [
  { id: 1, title: 'Graduating students', icon: GraduationCap },
  { id: 2, title: 'Promotions preview', icon: TrendingUp },
  { id: 3, title: 'New academic year', icon: CalendarRange },
  { id: 4, title: 'Confirm & execute', icon: CheckCircle2 },
] as const;

const EndOfYearWizard: React.FC = () => {
  const { schoolId } = useSchool();
  const { refresh } = useData();
  const [step, setStep] = useState(1);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [currentYearId, setCurrentYearId] = useState<number | null>(null);
  const [newYearId, setNewYearId] = useState<number | null>(null);
  const [newYearName, setNewYearName] = useState('');
  const [newYearStart, setNewYearStart] = useState('');
  const [preview, setPreview] = useState<YearEndPreview | null>(null);
  const [repeatIds, setRepeatIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ graduated: number; promoted: number; repeated: number } | null>(null);

  const tenantPath = schoolId ? `/schools/${schoolId}` : '';

  const loadYears = useCallback(async () => {
    if (!schoolId) return;
    apiService.setTenantContext(schoolId);
    const data = await apiService.get<{ years: AcademicYear[] }>(`${tenantPath}/academic-years`);
    setYears(data.years || []);
    const current = data.years?.find((y) => y.is_current || y.status === 'active');
    if (current) setCurrentYearId(current.id);
  }, [schoolId, tenantPath]);

  useEffect(() => {
    void loadYears().catch(() => {
      toast({ title: 'Could not load academic years', variant: 'destructive' });
    });
  }, [loadYears]);

  const finalClassStudents = useMemo(() => {
    if (!preview) return [];
    return preview.classes
      .filter((c) => c.isFinalClass)
      .flatMap((c) => c.actions.filter((a) => a.action === 'graduate' || a.action === 'repeat'));
  }, [preview]);

  const loadPreview = async () => {
    if (!schoolId || !currentYearId) return;
    setLoading(true);
    try {
      apiService.setTenantContext(schoolId);
      const data = await apiService.post<YearEndPreview>(`${tenantPath}/academic-year/preview`, {
        current_year_id: currentYearId,
      });
      setPreview(data);
      setRepeatIds(new Set());
    } catch (error) {
      toast({
        title: 'Preview failed',
        description: error instanceof Error ? error.message : 'Could not load preview',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRepeat = async (enrollmentId: number, markRepeat: boolean) => {
    try {
      if (markRepeat) {
        await apiService.patch(`/enrollments/${enrollmentId}/mark-repeat`, {});
        setRepeatIds((prev) => new Set(prev).add(enrollmentId));
      } else {
        await apiService.patch(`/enrollments/${enrollmentId}/unmark-repeat`, {});
        setRepeatIds((prev) => {
          const next = new Set(prev);
          next.delete(enrollmentId);
          return next;
        });
      }
      await loadPreview();
    } catch (error) {
      toast({
        title: 'Update failed',
        description: error instanceof Error ? error.message : 'Could not update student',
        variant: 'destructive',
      });
    }
  };

  const createNewYear = async () => {
    if (!schoolId || !newYearName.trim()) return;
    setLoading(true);
    try {
      apiService.setTenantContext(schoolId);
      const data = await apiService.post<{ year: AcademicYear }>(`${tenantPath}/academic-years`, {
        name: newYearName.trim(),
        startDate: newYearStart || undefined,
      });
      await loadYears();
      setNewYearId(data.year.id);
      toast({ title: 'Academic year created', description: data.year.name });
    } catch (error) {
      toast({
        title: 'Create failed',
        description: error instanceof Error ? error.message : 'Could not create year',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const executeYearEnd = async () => {
    if (!schoolId || !currentYearId || !newYearId) return;
    setExecuting(true);
    try {
      apiService.setTenantContext(schoolId);
      const data = await apiService.post<{ graduated: number; promoted: number; repeated: number }>(
        `${tenantPath}/academic-year/end`,
        { current_year_id: currentYearId, new_year_id: newYearId }
      );
      setResult(data);
      await refresh();
      toast({ title: 'Year-end completed successfully' });
    } catch (error) {
      toast({
        title: 'Year-end failed',
        description: error instanceof Error ? error.message : 'Operation rolled back',
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  };

  const adjustedSummary = useMemo(() => {
    if (!preview) return { graduate: 0, promote: 0, repeat: 0 };
    return preview.summary;
  }, [preview]);

  const promotionRows = useMemo(() => {
    if (!preview) return [];
    return preview.classes
      .filter((c) => !c.isFinalClass && c.actions.length > 0)
      .map((c) => {
        const target = c.actions[0]?.toClassName || '—';
        return { from: c.className, to: target, count: c.actions.length };
      });
  }, [preview]);

  if (result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 className="h-6 w-6" />
              Academic year transition complete
            </CardTitle>
            <CardDescription>The end-of-year cycle finished successfully.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{result.graduated}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Graduated</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{result.promoted}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Promoted</p>
            </div>
            <div className="rounded-xl bg-white p-4 text-center shadow-sm">
              <p className="text-2xl font-bold text-slate-900">{result.repeated}</p>
              <p className="text-xs uppercase tracking-wide text-slate-500">Repeated</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
          <School className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">End-of-Year Academic Cycle</h1>
          <p className="text-sm text-slate-500">
            Graduate final-year students, promote classes, and open a new academic year. All changes run in a single transaction.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STEPS.map((s) => (
          <Badge
            key={s.id}
            variant={step === s.id ? 'default' : 'outline'}
            className="gap-1.5 px-3 py-1.5"
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.title}
          </Badge>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Review graduating students</CardTitle>
            <CardDescription>
              Students in final classes (JHS 3, SHS 3, etc.) will graduate unless marked to repeat.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Closing academic year</Label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={currentYearId ?? ''}
                  onChange={(e) => setCurrentYearId(Number(e.target.value))}
                >
                  {years.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name} {y.is_current ? '(current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={() => void loadPreview()} disabled={loading || !currentYearId}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Load preview
                </Button>
              </div>
            </div>

            {preview && (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  <Badge variant="secondary">{adjustedSummary.graduate} will graduate</Badge>
                  <Badge variant="outline">{adjustedSummary.repeat} will repeat</Badge>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left">Graduate</th>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2 text-left">Class</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalClassStudents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-500">
                            No students in final classes for this year.
                          </td>
                        </tr>
                      ) : (
                        finalClassStudents.map((s) => {
                          const willRepeat = repeatIds.has(s.enrollmentId) || s.action === 'repeat';
                          return (
                            <tr key={s.enrollmentId} className="border-t">
                              <td className="px-3 py-2">
                                <Checkbox
                                  checked={!willRepeat}
                                  onCheckedChange={(checked) =>
                                    void toggleRepeat(s.enrollmentId, checked !== true)
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <div className="font-medium">{s.studentName}</div>
                                <div className="text-xs text-slate-500">{s.studentCode}</div>
                              </td>
                              <td className="px-3 py-2">{s.fromClassName}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500">Uncheck a student to mark them as repeating the final class.</p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {step === 2 && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Review promotions</CardTitle>
            <CardDescription>Read-only preview of class movements for the new year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {promotionRows.length === 0 ? (
              <p className="text-sm text-slate-500">No promotion rows — load preview on step 1 first.</p>
            ) : (
              promotionRows.map((row) => (
                <div
                  key={row.from}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-slate-50 px-4 py-3"
                >
                  <span className="font-medium">{row.from}</span>
                  <span className="text-slate-400">→</span>
                  <span className="font-medium text-indigo-700">{row.to}</span>
                  <Badge>{row.count} students</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Set new academic year</CardTitle>
            <CardDescription>Select an existing year or create the incoming year.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Select new year</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newYearId ?? ''}
                onChange={(e) => setNewYearId(Number(e.target.value))}
              >
                <option value="">Choose year…</option>
                {years
                  .filter((y) => y.id !== currentYearId)
                  .map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <p className="text-sm font-medium">Or create a new year</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Year name</Label>
                  <Input
                    placeholder="2025/2026"
                    value={newYearName}
                    onChange={(e) => setNewYearName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Start date</Label>
                  <Input type="date" value={newYearStart} onChange={(e) => setNewYearStart(e.target.value)} />
                </div>
              </div>
              <Button variant="outline" onClick={() => void createNewYear()} disabled={loading || !newYearName.trim()}>
                Create year
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && preview && (
        <Card className="border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Confirm &amp; execute
            </CardTitle>
            <CardDescription>This action cannot be undone. All changes roll back if any step fails.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Closing</p>
                <p className="font-semibold">{preview.currentYearName}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Opening</p>
                <p className="font-semibold">{years.find((y) => y.id === newYearId)?.name || '—'}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-slate-500">Summary</p>
                <p className="font-semibold">
                  {adjustedSummary.graduate} grad · {adjustedSummary.promote} promote · {adjustedSummary.repeat} repeat
                </p>
              </div>
            </div>
            <Button
              className="w-full sm:w-auto"
              variant="destructive"
              disabled={executing || !newYearId}
              onClick={() => void executeYearEnd()}
            >
              {executing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Run end-of-year transition
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button variant="outline" disabled={step <= 1} onClick={() => setStep((s) => s - 1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <Button
          disabled={(step === 1 && !preview) || (step === 3 && !newYearId) || step >= 4}
          onClick={() => setStep((s) => Math.min(4, s + 1))}
        >
          Next
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default EndOfYearWizard;
