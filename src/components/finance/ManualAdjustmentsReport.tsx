import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { apiService } from '../../services/api';
import { formatGhs } from '../../utils/currency';
import { FileSearch, Loader2, RefreshCw, Scale, Search, ShieldCheck, Wallet, ChevronRight } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import ManualBalanceOverrideDialog, { type FeeBreakdownForOverride } from './ManualBalanceOverrideDialog';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { calculateStudentFeesSync, getActiveAcademicTerm } from '../../utils/feeCalculations';
import { formatDisplayDate, formatDisplayDateTime, formatDisplayTime } from '../../utils/dateFormat';

type AdjRow = {
  id: number;
  student_id: number;
  created_at: string;
  description: string;
  debit: string | number;
  credit: string | number;
  adjustment_amount?: string | number | null;
  adjustment_category?: string | null;
  adjustment_notes?: string | null;
  supporting_document_url?: string | null;
  created_by_user_id?: number | null;
  period_label?: string | null;
  first_name: string;
  last_name: string;
  school_student_id?: string;
  created_by_username?: string | null;
  created_by_full_name?: string | null;
  approved_by_username?: string | null;
  approved_by_full_name?: string | null;
  balance_before?: number | null;
  balance_after?: number | null;
  recorded_by_display?: string | null;
};

type SearchMatch = {
  id: number;
  first_name: string;
  last_name: string;
  student_id: string;
  admission_number?: string | null;
  class_name?: string | null;
};

type LedgerRow = {
  id: number;
  description: string;
  entry_type: string;
  debit: string | number;
  credit: string | number;
  created_at: string;
  adjustment_category?: string | null;
  adjustment_notes?: string | null;
};

type Summary = {
  balance: number;
  status: string;
  history: LedgerRow[];
  current_term?: string;
  current_year?: string;
  term_arrears?: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace('/api', '');

function docUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

function splitDateTime(iso: string): { dateLine: string; timeLine: string; isoLocal: string } {
  return {
    dateLine: formatDisplayDate(iso),
    timeLine: formatDisplayTime(iso),
    isoLocal: formatDisplayDateTime(iso),
  };
}

function rowAdjustment(r: AdjRow): number {
  return r.adjustment_amount != null && r.adjustment_amount !== ''
    ? Number(r.adjustment_amount)
    : Number(r.debit || 0) - Number(r.credit || 0);
}

const ManualAdjustmentsReport: React.FC = () => {
  const { students, payments, feeStructures, arrearsBalances } = useData();
  const { currentTerm: activeTermFromContext } = useActiveTerm();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filterStudentDbId, setFilterStudentDbId] = useState('');
  const [filterRecordedByUserId, setFilterRecordedByUserId] = useState('');
  const [rows, setRows] = useState<AdjRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchMatches, setSearchMatches] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<SearchMatch | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [detailRow, setDetailRow] = useState<AdjRow | null>(null);

  const loadSummary = useCallback(async (studentDbId: number) => {
    setSummaryLoading(true);
    try {
      const data = await apiService.get<Summary>(`/finance/student/${studentDbId}/summary`);
      setSummary(data);
    } catch (e: any) {
      toast({ title: 'Could not load ledger', description: e?.message || 'Error', variant: 'destructive' });
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedStudent) {
      void loadSummary(selectedStudent.id);
    } else {
      setSummary(null);
    }
  }, [selectedStudent, loadSummary]);

  const runStudentSearch = async () => {
    const q = searchQ.trim();
    if (q.length < 1) {
      toast({ title: 'Enter a search', description: 'School student ID, admission number, or name.', variant: 'destructive' });
      return;
    }
    setSearching(true);
    try {
      const res = await apiService.get<{ matches: SearchMatch[] }>(
        `/finance/student-override-search?q=${encodeURIComponent(q)}`
      );
      const list = Array.isArray(res?.matches) ? res.matches : [];
      setSearchMatches(list);
      if (list.length === 0) {
        toast({ title: 'No students found', description: 'Try a different ID or name.' });
      }
    } catch (e: any) {
      toast({ title: 'Search failed', description: e?.message || 'Error', variant: 'destructive' });
      setSearchMatches([]);
    } finally {
      setSearching(false);
    }
  };

  const runReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (from) q.set('from', new Date(from).toISOString());
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        q.set('to', end.toISOString());
      }
      if (filterStudentDbId.trim()) q.set('studentId', filterStudentDbId.trim());
      if (filterRecordedByUserId.trim()) q.set('createdBy', filterRecordedByUserId.trim());
      const res = await apiService.get<{ adjustments: AdjRow[] }>(`/finance/manual-adjustments?${q.toString()}`);
      setRows(Array.isArray(res?.adjustments) ? res.adjustments : []);
    } catch (e: any) {
      toast({ title: 'Report failed', description: e?.message || 'Could not load data', variant: 'destructive' });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const selectMatch = (m: SearchMatch) => {
    setSelectedStudent(m);
    setOverrideOpen(false);
  };

  const termForFees = useMemo(() => {
    const t = (activeTermFromContext || '').trim();
    if (t && t !== 'Not Set') return t;
    return getActiveAcademicTerm();
  }, [activeTermFromContext]);

  const matchedStudent = useMemo(() => {
    if (!selectedStudent) return null;
    return students.find((s) => String(s.id) === String(selectedStudent.id)) ?? null;
  }, [selectedStudent, students]);

  const feeBreakdown = useMemo((): FeeBreakdownForOverride | null => {
    if (!matchedStudent) return null;
    const term = termForFees.trim();
    if (!term || term === 'Not Set') return null;
    const calc = calculateStudentFeesSync(
      matchedStudent.id,
      term,
      matchedStudent.classAssigned,
      feeStructures || [],
      payments || [],
      matchedStudent.classAssignedId,
      arrearsBalances,
      {
        isBeneficiary: !!matchedStudent.isBeneficiary,
        discountType: matchedStudent.discountType,
        discountValue: matchedStudent.discountValue,
      }
    );
    return {
      termFee: calc.currentTermFee,
      arrears: calc.arrears,
      totalDue: calc.totalAmountDue,
      paid: calc.totalPaid,
      balance: calc.totalAmountDue - calc.totalPaid,
    };
  }, [matchedStudent, termForFees, feeStructures, payments, arrearsBalances]);

  const bal = summary ? Number(summary.balance) : 0;
  const feeBal = feeBreakdown?.balance ?? null;
  const ledgerFeeMismatch = feeBal != null && Math.abs(bal - feeBal) > 0.02;
  const recentHistory = summary?.history ? [...summary.history].reverse().slice(0, 20) : [];
  const ct = (summary?.current_term || '').trim();
  const cy = (summary?.current_year || '').trim();
  const activePeriodConfigured = !!(ct && cy);
  const activePeriodLabel = activePeriodConfigured ? `${ct} · ${cy}` : '—';

  return (
    <div className="mx-auto w-full max-w-[min(100%,1680px)] space-y-5 px-3 py-4 md:space-y-6 md:px-4 md:py-5">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-slate-50 to-white px-4 py-5 shadow-sm dark:from-slate-950 dark:to-slate-900/80 md:px-5 md:py-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="h-6 w-6 shrink-0" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest">Finance · trusted ledger</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Balance overrides</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Search by student ID, apply corrections on the official ledger. Every change is append-only, labelled with the
              active term, and recorded in the audit log.
            </p>
          </div>
        </div>
      </div>

      <Card className="overflow-hidden border-border/80 shadow-md ring-1 ring-black/[0.03] dark:ring-white/10">
        <CardHeader className="border-b border-border/60 bg-muted/25 pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5 text-primary" />
            Apply manual balance override
          </CardTitle>
          <CardDescription className="text-pretty">
            Search by school student ID, admission number, database ID, or name. Each override is stamped with the{' '}
            <span className="font-medium text-foreground">active term from School Settings</span> — no manual term selection.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="ov-search">Find student</Label>
              <Input
                id="ov-search"
                placeholder="e.g. STU-1024 or John Doe"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void runStudentSearch();
                }}
              />
            </div>
            <Button type="button" variant="primaryAction" className="gap-2 sm:mb-0.5" onClick={() => void runStudentSearch()} disabled={searching}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {searchMatches.length > 0 && (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead className="w-[100px] text-right">Select</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchMatches.map((m) => (
                    <TableRow key={m.id} className={selectedStudent?.id === m.id ? 'bg-primary/5' : undefined}>
                      <TableCell className="font-medium">
                        {m.first_name} {m.last_name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{m.student_id}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{m.class_name || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant={selectedStudent?.id === m.id ? 'secondary' : 'outline'} onClick={() => selectMatch(m)}>
                          {selectedStudent?.id === m.id ? 'Selected' : 'Select'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {selectedStudent && (
            <div className="space-y-5 rounded-2xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold tracking-tight">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    School ID: <span className="font-mono text-foreground">{selectedStudent.student_id}</span>
                    {selectedStudent.admission_number ? ` · Adm. ${selectedStudent.admission_number}` : ''}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedStudent(null)}>
                  Clear selection
                </Button>
              </div>

              {summaryLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading ledger…
                </div>
              ) : summary ? (
                <>
                  {!activePeriodConfigured && (
                    <Alert className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
                      <AlertTitle className="text-amber-950 dark:text-amber-50">Set active term in Settings</AlertTitle>
                      <AlertDescription>
                        Overrides are tied to the current academic period. Add the current term and year under School Settings
                        before applying an adjustment.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border/80 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                    <span className="font-medium uppercase tracking-wide">Recording period</span>
                    <span className="font-mono text-sm text-foreground">{activePeriodLabel}</span>
                  </div>

                  {!matchedStudent && (
                    <Alert>
                      <AlertTitle>Fee details unavailable</AlertTitle>
                      <AlertDescription>
                        This student is not in the loaded roster for this school, so term fee / payment totals cannot be shown.
                        Reload the app or switch school, then search again.
                      </AlertDescription>
                    </Alert>
                  )}

                  {feeBreakdown && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Current term — fees &amp; payments (same as fee status report)
                      </p>
                      <div className="overflow-x-auto rounded-xl border bg-background shadow-sm">
                        <Table className="min-w-[520px]">
                          <TableHeader>
                            <TableRow className="bg-muted/50 hover:bg-muted/50">
                              <TableHead className="text-right">Term fee</TableHead>
                              <TableHead className="text-right">Arrears</TableHead>
                              <TableHead className="text-right">Total due</TableHead>
                              <TableHead className="text-right">Paid</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell className="text-right font-mono tabular-nums">{formatGhs(feeBreakdown.termFee)}</TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                                {formatGhs(feeBreakdown.arrears)}
                              </TableCell>
                              <TableCell className="text-right font-mono font-semibold tabular-nums">
                                {formatGhs(feeBreakdown.totalDue)}
                              </TableCell>
                              <TableCell className="text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                                {formatGhs(feeBreakdown.paid)}
                              </TableCell>
                              <TableCell
                                className={`text-right font-mono font-semibold tabular-nums ${
                                  feeBreakdown.balance > 0
                                    ? 'text-red-600 dark:text-red-400'
                                    : feeBreakdown.balance < 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : ''
                                }`}
                              >
                                {formatGhs(feeBreakdown.balance)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {ledgerFeeMismatch && feeBreakdown && (
                    <Alert className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
                      <AlertTitle className="text-amber-950 dark:text-amber-50">Ledger differs from fee balance</AlertTitle>
                      <AlertDescription>
                        Fee view shows <span className="font-mono font-medium">{formatGhs(feeBreakdown.balance)}</span> still owing
                        (or credit), while the ledger total is <span className="font-mono font-medium">{formatGhs(bal)}</span>. The
                        override updates the <span className="font-medium">ledger</span> only — use the dialog to set the ledger to
                        match reality (often the same as the fee balance).
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="relative overflow-hidden rounded-xl border border-primary/15 bg-card p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Wallet className="h-4 w-4 shrink-0" aria-hidden />
                      <p className="text-xs font-semibold uppercase tracking-wide">Official ledger balance</p>
                    </div>
                    <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight text-foreground">{formatGhs(bal)}</p>
                    <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                      Cumulative debit − credit on the student ledger. The server uses this amount as the baseline when you apply an
                      override.
                    </p>
                    <Badge
                      variant={bal > 0 ? 'destructive' : bal < 0 ? 'outline' : 'secondary'}
                      className="absolute right-3 top-3 capitalize"
                    >
                      {summary.status}
                    </Badge>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent ledger (newest first)</p>
                    <ScrollArea className="h-[220px] rounded-xl border bg-background shadow-inner">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[110px]">Date</TableHead>
                            <TableHead>Entry</TableHead>
                            <TableHead className="text-right w-[90px]">Debit</TableHead>
                            <TableHead className="text-right w-[90px]">Credit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {recentHistory.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                                {new Date(row.created_at).toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs">
                                <div className="line-clamp-2">{row.description}</div>
                                <span className="text-[10px] capitalize text-muted-foreground">{row.entry_type.replace(/_/g, ' ')}</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums">
                                {Number(row.debit) > 0 ? formatGhs(Number(row.debit)) : '—'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs tabular-nums">
                                {Number(row.credit) > 0 ? formatGhs(Number(row.credit)) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    className="w-full gap-2 sm:w-auto sm:min-w-[220px]"
                    onClick={() => setOverrideOpen(true)}
                    disabled={!activePeriodConfigured}
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Manual balance override
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="h-5 w-5" />
            Adjustment history report
          </CardTitle>
          <CardDescription>Filter past manual adjustments (up to 500 rows).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>From date</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To date</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Filter by database student id</Label>
              <Input inputMode="numeric" placeholder="Optional" value={filterStudentDbId} onChange={(e) => setFilterStudentDbId(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Recorded by (user id)</Label>
              <Input inputMode="numeric" placeholder="Optional" value={filterRecordedByUserId} onChange={(e) => setFilterRecordedByUserId(e.target.value)} />
            </div>
          </div>
          <Button type="button" variant="primaryAction" onClick={() => void runReport()} disabled={loading} className="w-fit gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Run report
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Report results ({rows.length})</CardTitle>
          <CardDescription>Click a row to open full details (balances, who recorded it, date and time).</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[min(75vh,640px)]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px]">When</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="text-right w-[110px]">Adjustment</TableHead>
                  <TableHead className="max-w-[200px]">Reason</TableHead>
                  <TableHead className="max-w-[120px]">Recorded by</TableHead>
                  <TableHead className="w-10 pr-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const adj = rowAdjustment(r);
                  const when = splitDateTime(r.created_at);
                  const shortDate = formatDisplayDate(r.created_at);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/60"
                      onClick={() => setDetailRow(r)}
                    >
                      <TableCell className="whitespace-nowrap align-top text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{shortDate}</div>
                        <div>{when.timeLine}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        <div className="font-medium">
                          {r.first_name} {r.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-mono">{r.school_student_id || '—'}</span> · DB {r.student_id}
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right font-mono text-sm tabular-nums">{formatGhs(adj, { signed: true })}</TableCell>
                      <TableCell className="max-w-[200px] align-top text-xs">
                        <div className="truncate font-medium capitalize">{(r.adjustment_category || '').replace(/_/g, ' ') || '—'}</div>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">{r.adjustment_notes || ''}</p>
                      </TableCell>
                      <TableCell className="max-w-[120px] truncate align-top text-xs" title={r.recorded_by_display || r.created_by_username || ''}>
                        {r.recorded_by_display || r.created_by_username || (r.created_by_user_id != null ? `#${r.created_by_user_id}` : '—')}
                      </TableCell>
                      <TableCell className="align-top pr-3 text-muted-foreground">
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      <Sheet open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          {detailRow && (
            <>
              <SheetHeader className="space-y-1 border-b pb-4 text-left">
                <SheetTitle>Adjustment detail</SheetTitle>
                <SheetDescription>Ledger entry #{detailRow.id}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-1 flex-col gap-5 py-6">
                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</h4>
                  <p className="mt-1 text-base font-semibold">
                    {detailRow.first_name} {detailRow.last_name}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    School ID <span className="font-mono text-foreground">{detailRow.school_student_id || '—'}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Database ID <span className="font-mono text-foreground">{detailRow.student_id}</span>
                  </p>
                </section>

                <Separator />

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date &amp; time</h4>
                  <p className="mt-1 text-sm font-medium text-foreground">{splitDateTime(detailRow.created_at).dateLine}</p>
                  <p className="text-sm text-muted-foreground">{splitDateTime(detailRow.created_at).timeLine}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{splitDateTime(detailRow.created_at).isoLocal}</p>
                </section>

                <Separator />

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Balances</h4>
                  <dl className="mt-2 space-y-2 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Previous ledger balance</dt>
                      <dd className="font-mono font-medium tabular-nums">
                        {detailRow.balance_before != null && Number.isFinite(detailRow.balance_before)
                          ? formatGhs(detailRow.balance_before)
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">New balance (after override)</dt>
                      <dd className="font-mono font-semibold tabular-nums text-primary">
                        {detailRow.balance_after != null && Number.isFinite(detailRow.balance_after)
                          ? formatGhs(detailRow.balance_after)
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Adjustment posted</dt>
                      <dd className="font-mono font-medium tabular-nums">{formatGhs(rowAdjustment(detailRow), { signed: true })}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Previous / new values are read from the ledger description when available; older entries may only store the
                    new balance.
                  </p>
                </section>

                {detailRow.period_label ? (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Academic period</h4>
                      <p className="mt-1 text-sm font-medium">{detailRow.period_label}</p>
                    </section>
                  </>
                ) : null}

                <Separator />

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason &amp; notes</h4>
                  <p className="mt-1 text-sm font-medium capitalize">{(detailRow.adjustment_category || '').replace(/_/g, ' ') || '—'}</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">
                    {detailRow.adjustment_notes || '—'}
                  </p>
                </section>

                <Separator />

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recorded by</h4>
                  <p className="mt-1 text-sm font-medium">
                    {detailRow.recorded_by_display ||
                      detailRow.created_by_full_name ||
                      detailRow.created_by_username ||
                      (detailRow.created_by_user_id != null ? `User id ${detailRow.created_by_user_id}` : '—')}
                  </p>
                  {detailRow.created_by_user_id != null && (
                    <p className="text-xs text-muted-foreground">User id {detailRow.created_by_user_id}</p>
                  )}
                </section>

                {(detailRow.approved_by_username || detailRow.approved_by_full_name) && (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approved by</h4>
                      <p className="mt-1 text-sm font-medium">
                        {[detailRow.approved_by_full_name, detailRow.approved_by_username].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </section>
                  </>
                )}

                {detailRow.supporting_document_url ? (
                  <>
                    <Separator />
                    <section>
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Document</h4>
                      <a
                        href={docUrl(detailRow.supporting_document_url) || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-sm font-medium text-primary underline"
                      >
                        Open supporting file
                      </a>
                    </section>
                  </>
                ) : null}

                <Separator />

                <section>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ledger description</h4>
                  <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{detailRow.description || '—'}</p>
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {selectedStudent && summary && (
        <ManualBalanceOverrideDialog
          open={overrideOpen}
          onOpenChange={setOverrideOpen}
          studentId={String(selectedStudent.id)}
          studentName={`${selectedStudent.first_name} ${selectedStudent.last_name} (${selectedStudent.student_id})`}
          ledgerBalance={Number(summary.balance)}
          feeBreakdown={feeBreakdown}
          activePeriodLabel={activePeriodLabel}
          activePeriodConfigured={activePeriodConfigured}
          onSuccess={() => void loadSummary(selectedStudent.id)}
        />
      )}
    </div>
  );
};

export default ManualAdjustmentsReport;
