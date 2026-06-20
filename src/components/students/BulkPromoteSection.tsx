import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GraduationCap, History, Loader2, TrendingUp } from 'lucide-react';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import { useData } from '@/contexts/DataContext';
import { resolveLogoUrl } from '@/services/tenantService';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DetailField,
  detailDialogBodyClass,
  detailDialogContentClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
} from '@/components/ui/dialog';
import { TooltipProvider } from '@/components/ui/tooltip';
import FeeBalanceIndicator from './FeeBalanceIndicator';

type ClassStudent = {
  id: number;
  fullName: string;
  studentId: string;
  photoUrl: string | null;
  className: string | null;
  status: string;
  hasOutstandingBalance: boolean;
  outstandingBalance?: number;
};

type ClassPayload = {
  class: { id: number; className: string; level: string | null; isFinalClass: boolean };
  students: ClassStudent[];
  suggestedToClassId: number | null;
  classes: Array<{ id: number; className: string; level: string | null; isFinalClass: boolean }>;
};

type HistoryRow = {
  id: string;
  studentName: string;
  studentNumber: string;
  fromClassName: string;
  toClassName: string;
  academicYear: string;
  promotedAt: string;
  promotedByName: string;
};

const BulkPromoteSection: React.FC = () => {
  const { classes, refresh } = useData();
  const { currentYear } = useActiveTerm();
  const [fromClassId, setFromClassId] = useState('');
  const [payload, setPayload] = useState<ClassPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toClassId, setToClassId] = useState('');
  const [graduateMode, setGraduateMode] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const academicYearLabel = useMemo(() => {
    const y = Number(currentYear) || new Date().getFullYear();
    return `${y}/${y + 1}`;
  }, [currentYear]);

  const loadClass = useCallback(async (classId: string) => {
    if (!classId) {
      setPayload(null);
      setSelected(new Set());
      return;
    }
    setLoading(true);
    try {
      const data = await apiService.get<ClassPayload>(`/promotions/class/${classId}/students`);
      setPayload(data);
      setSelected(new Set(data.students.map((s) => s.id)));
      if (data.class.isFinalClass) {
        setGraduateMode(true);
        setToClassId('GRADUATE');
      } else if (data.suggestedToClassId) {
        setGraduateMode(false);
        setToClassId(String(data.suggestedToClassId));
      } else {
        setGraduateMode(false);
        setToClassId('');
      }
    } catch {
      toast({ title: 'Could not load students', variant: 'destructive' });
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadClass(fromClassId);
  }, [fromClassId, loadClass]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const rows = await apiService.get<HistoryRow[]>('/promotions/history');
      setHistory(rows);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (showHistory) void loadHistory();
  }, [showHistory, loadHistory]);

  const students = payload?.students ?? [];
  const allSelected = students.length > 0 && selected.size === students.length;
  const someSelected = selected.size > 0 && !allSelected;
  const selectedStudents = students.filter((s) => selected.has(s.id));
  const selectedWithBalance = selectedStudents.filter((s) => (s.outstandingBalance ?? 0) > 0.01);
  const fromClassName = payload?.class.className ?? '';
  const toClassName =
    graduateMode || toClassId === 'GRADUATE'
      ? 'Graduate (Alumni)'
      : payload?.classes.find((c) => String(c.id) === toClassId)?.className ?? '';

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.id)));
  };

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runPromotion = async () => {
    if (!fromClassId || selected.size === 0) return;
    setSubmitting(true);
    try {
      const res = await apiService.post<{ promotedCount: number }>('/promotions/bulk', {
        studentIds: [...selected],
        fromClassId: Number(fromClassId),
        toClassId: graduateMode || toClassId === 'GRADUATE' ? 'GRADUATE' : Number(toClassId),
        academicYear: academicYearLabel,
      });
      toast({
        title: 'Promotion successful',
        description: `${res.promotedCount} student${res.promotedCount === 1 ? '' : 's'} ${
          graduateMode ? 'graduated' : `promoted to ${toClassName}`
        }`,
      });
      await refresh(['students', 'classes']);
      setConfirmOpen(false);
      setFromClassId('');
      setPayload(null);
      setSelected(new Set());
    } catch (e: unknown) {
      toast({
        title: 'Promotion failed',
        description: e instanceof Error ? e.message : 'Something went wrong',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (showHistory) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" className="rounded-xl" onClick={() => setShowHistory(false)}>
            ← Back to bulk promote
          </Button>
        </div>
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900/50">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Promotion history</h3>
          <p className="mt-1 text-sm text-slate-500">Recent class promotions and graduations</p>
          {loadingHistory ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-8 text-sm text-slate-400">No promotion records yet.</p>
          ) : (
            <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-800/50">
                    {['Student', 'From', 'To', 'Year', 'Date', 'By'].map((h) => (
                      <th key={h} className="px-4 py-3 font-semibold text-slate-500">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3">
                        <div className="font-medium">{row.studentName}</div>
                        <div className="text-xs text-slate-400">{row.studentNumber}</div>
                      </td>
                      <td className="px-4 py-3">{row.fromClassName}</td>
                      <td className="px-4 py-3">{row.toClassName}</td>
                      <td className="px-4 py-3">{row.academicYear || '—'}</td>
                      <td className="px-4 py-3">{new Date(row.promotedAt).toLocaleString()}</td>
                      <td className="px-4 py-3">{row.promotedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Pick a class, select students with checkboxes, then promote the chosen group.
        </p>
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => setShowHistory(true)}>
          <History className="h-4 w-4" />
          View history
        </Button>
      </div>

      <div className="max-w-md space-y-2.5">
        <Label className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-300">Promoting from</Label>
        <Select value={fromClassId} onValueChange={setFromClassId}>
          <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-medium dark:border-slate-700 dark:bg-slate-800/50">
            <SelectValue placeholder="Select class…" />
          </SelectTrigger>
          <SelectContent className="rounded-2xl shadow-2xl">
            {classes.map((c) => (
              <SelectItem key={c.id} value={c.id} className="rounded-xl">
                {c.className}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="py-12 text-center text-slate-500">
          <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
          Loading students…
        </div>
      )}

      {!loading && fromClassId && students.length === 0 && (
        <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/30">
          <p className="font-medium text-slate-600 dark:text-slate-400">No students in this class</p>
        </div>
      )}

      {!loading && students.length > 0 && (
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900/30">
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
              aria-label="Select all students"
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selected.size} of {students.length} students selected
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/80">
                <tr className="border-b border-slate-200 text-left dark:border-slate-700">
                  <th className="w-12 p-3" />
                  <th className="p-3 font-semibold text-slate-500">Photo</th>
                  <th className="p-3 font-semibold text-slate-500">Name</th>
                  <th className="p-3 font-semibold text-slate-500">Student ID</th>
                  <th className="p-3 font-semibold text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const isSel = selected.has(s.id);
                  const photo = resolveLogoUrl(s.photoUrl);
                  return (
                    <tr
                      key={s.id}
                      onClick={() => toggleOne(s.id)}
                      className={`cursor-pointer border-b border-slate-100 transition-colors dark:border-slate-800 ${
                        isSel ? 'bg-indigo-50/80 dark:bg-indigo-500/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={isSel} onCheckedChange={() => toggleOne(s.id)} />
                      </td>
                      <td className="p-3">
                        {photo ? (
                          <img src={photo} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-500">
                            {s.fullName.slice(0, 1)}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">
                        <span className="inline-flex items-center gap-2">
                          {s.fullName}
                          <FeeBalanceIndicator
                            amount={s.outstandingBalance ?? 0}
                            onClickStop
                          />
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">{s.studentId}</td>
                      <td className="p-3 capitalize text-slate-500">{s.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="rounded-[1.5rem] border border-indigo-200 bg-indigo-50/50 p-6 dark:border-indigo-800/50 dark:bg-indigo-500/10">
          <p className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
            {selected.size} student{selected.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xs flex-1 space-y-2">
              <Label className="text-sm font-medium text-slate-700 dark:text-slate-300">Promote to</Label>
              {payload?.class.isFinalClass ? (
                <Select
                  value={graduateMode ? 'GRADUATE' : toClassId}
                  onValueChange={(v) => {
                    if (v === 'GRADUATE') {
                      setGraduateMode(true);
                      setToClassId('GRADUATE');
                    } else {
                      setGraduateMode(false);
                      setToClassId(v);
                    }
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GRADUATE">
                      <span className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4" /> Graduate (Alumni)
                      </span>
                    </SelectItem>
                    {payload.classes
                      .filter((c) => c.id !== payload.class.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.className}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={toClassId}
                  onValueChange={(v) => {
                    setGraduateMode(false);
                    setToClassId(v);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Select class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {payload?.classes
                      .filter((c) => c.id !== payload?.class.id)
                      .map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.className}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="rounded-xl" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              <Button
                variant="primaryAction"
                className="rounded-xl px-8"
                disabled={!toClassId && !graduateMode}
                onClick={() => setConfirmOpen(true)}
              >
                Promote {selected.size} student{selected.size === 1 ? '' : 's'} →
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <TrendingUp className="h-4 w-4" />
              </span>
              Promote {selected.size} student{selected.size === 1 ? '' : 's'}?
            </DialogTitle>
            <DialogDescription>
              Review the promotion details below. Students with a fee balance can still be promoted — hover the warning icon to see the amount owing.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-5`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <DetailField label="From">{fromClassName || '—'}</DetailField>
              <DetailField label="To">{toClassName || '—'}</DetailField>
              <DetailField label="Academic year">{academicYearLabel}</DetailField>
            </div>

            {selectedWithBalance.length > 0 && (
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
                <p className="font-semibold">
                  {selectedWithBalance.length} selected student{selectedWithBalance.length === 1 ? '' : 's'}{' '}
                  {selectedWithBalance.length === 1 ? 'has' : 'have'} an outstanding fee balance.
                </p>
                <p className="mt-1 text-xs text-amber-800/90 dark:text-amber-200/80">
                  Promotion will proceed — balances remain on their account as arrears.
                </p>
              </div>
            )}

            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                Students to be moved
              </p>
              <div className="max-h-[220px] space-y-2 overflow-y-auto rounded-2xl border border-emerald-100 bg-emerald-50/30 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                {selectedStudents.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      {s.fullName.slice(0, 1)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{s.fullName}</p>
                      <p className="text-xs text-slate-500">{s.studentId}</p>
                    </div>
                    <FeeBalanceIndicator amount={s.outstandingBalance ?? 0} />
                  </div>
                ))}
              </div>
            </div>
          </DialogBody>

          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" className="rounded-xl" onClick={() => setConfirmOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primaryAction" className="rounded-xl px-8" onClick={() => void runPromotion()} disabled={submitting}>
              {submitting ? 'Promoting…' : 'Confirm promotion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
};

export default BulkPromoteSection;
