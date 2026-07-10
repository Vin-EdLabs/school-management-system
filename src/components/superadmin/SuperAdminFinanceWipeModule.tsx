import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DetailField,
  detailDialogBodyClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
  formDialogContentClass,
  dialogTitleClass,
  dialogLabelClass,
  dialogSectionClass,
} from '@/components/ui/dialog';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  CheckCircle2,
  Database,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';

type School = { id: number; name: string; is_active?: boolean };

type LedgerTerm = {
  id: number;
  name: string;
  status?: string;
  academic_year?: string;
  is_current?: boolean;
  academic_is_active?: boolean;
  academic_term_name?: string;
  ledger_rows?: number;
  payments_total?: number | string;
};

type ClassRow = { id: number; name: string };

type StudentRow = {
  id: number;
  first_name: string;
  last_name: string;
  admission_number?: string;
};

type WipeResult = {
  success: boolean;
  wiped: {
    scope: string;
    termId: number;
    studentsAffected: number;
    ledgerRowsDeleted: number;
    paymentRowsDeleted: number;
    feeStructureRowsDeleted: number;
    snapshotRowsDeleted: number;
  };
};

type TermFinanceLink = {
  key: string;
  label: string;
  count: number;
  amount: number;
  willDelete: boolean;
  note?: string;
};

type TermDeletePreview = {
  tenantId: number;
  ledgerTermId: number;
  termName: string;
  academicYear: string;
  status: string;
  isCurrent: boolean;
  startDate?: string | null;
  endDate?: string | null;
  closedAt: string | null;
  academicTerms: Array<{
    id: number;
    termName: string;
    year: string;
    isActive: boolean;
    closedAt: string | null;
  }>;
  totals: {
    studentsWithLedger: number;
    totalDebits: number;
    totalCredits: number;
    netBalance: number;
    paymentsAmount: number;
    feeStructuresTotal: number;
  };
  links: TermFinanceLink[];
  preserved: string[];
  canDelete: boolean;
  blockReason: string | null;
};

type TermDeleteResult = {
  success: boolean;
  deletedLedgerTermId: number;
  termLabel: string;
  academicYear: string;
  deleted: Record<string, number>;
  academicTermsUnlinked: number;
};

type SuperAdminFinanceWipeModuleProps = {
  schools: School[];
};

const destructiveDialogClass = cn(
  formDialogContentClass,
  '!border-t-red-500 shadow-[0_20px_60px_rgba(220,38,38,0.16)] dark:shadow-[0_20px_60px_rgba(220,38,38,0.12)]'
);

const successDialogClass = cn(formDialogContentClass, '!border-t-emerald-500');

function money(n: number) {
  return `GHS ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function termStatusBadge(status?: string, isCurrent?: boolean) {
  if (isCurrent) return { label: 'Current', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/25' };
  if (status === 'closed') return { label: 'Closed', className: 'bg-slate-500/10 text-slate-600 border-slate-500/25' };
  return { label: status || 'Active', className: 'bg-blue-500/10 text-blue-700 border-blue-500/25' };
}

const SCOPE_OPTIONS = [
  {
    value: 'school' as const,
    label: 'Entire school',
    description: 'Remove all finance records for this term across every class and student.',
    icon: Building2,
  },
  {
    value: 'class' as const,
    label: 'Specific class',
    description: 'Wipe fee bills and payments for students in one class only.',
    icon: Users,
  },
  {
    value: 'student' as const,
    label: 'Specific student',
    description: 'Target a single student’s term finance records.',
    icon: UserRound,
  },
];

const SuperAdminFinanceWipeModule: React.FC<SuperAdminFinanceWipeModuleProps> = ({ schools }) => {
  const [tenantId, setTenantId] = useState<number | null>(schools[0]?.id ?? null);
  const [terms, setTerms] = useState<LedgerTerm[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [deleteTermId, setDeleteTermId] = useState<number | null>(null);
  const [scope, setScope] = useState<'school' | 'class' | 'student'>('school');
  const [classId, setClassId] = useState<number | null>(null);
  const [studentId, setStudentId] = useState<number | null>(null);
  const [studentQuery, setStudentQuery] = useState('');
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [understandChecked, setUnderstandChecked] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [lastResult, setLastResult] = useState<WipeResult | null>(null);
  const [forceClosingId, setForceClosingId] = useState<number | null>(null);

  const [preview, setPreview] = useState<TermDeletePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteUnderstood, setDeleteUnderstood] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<TermDeleteResult | null>(null);
  const [deleteSuccessOpen, setDeleteSuccessOpen] = useState(false);

  const forceCloseableTerms = useMemo(
    () =>
      terms.filter(
        (t) =>
          t.status !== 'closed' &&
          t.status !== 'closing' &&
          !t.academic_is_active
      ),
    [terms]
  );

  const selectedSchool = schools.find((s) => s.id === tenantId) ?? null;
  const selectedTerm = terms.find((t) => t.id === termId) ?? null;
  const selectedDeleteTerm = terms.find((t) => t.id === deleteTermId) ?? null;
  const selectedClass = classes.find((c) => c.id === classId) ?? null;
  const selectedStudent = students.find((s) => s.id === studentId) ?? null;

  const requiredPhrase = useMemo(() => {
    if (!selectedTerm) return '';
    return `WIPE ${String(selectedTerm.name).toUpperCase()}`.trim();
  }, [selectedTerm]);

  const deleteRequiredPhrase = 'DELETE TERM';
  const phraseMatches = confirmPhrase.trim() === requiredPhrase;
  const deletePhraseMatches = deletePhrase.trim() === deleteRequiredPhrase;
  const canOpenConfirm =
    !!tenantId &&
    !!termId &&
    (scope !== 'class' || !!classId) &&
    (scope !== 'student' || !!studentId);

  const canConfirmWipe = phraseMatches && understandChecked && !wiping;
  const canConfirmDelete =
    !!preview &&
    preview.canDelete &&
    deletePhraseMatches &&
    deleteUnderstood &&
    !deleting;

  const loadTerms = useCallback(async (id: number) => {
    const data = await apiService.get<LedgerTerm[]>(`/super-admin/finance/tenants/${id}/terms`);
    setTerms(Array.isArray(data) ? data : []);
  }, []);

  const loadClasses = useCallback(async (id: number) => {
    const data = await apiService.get<ClassRow[]>(`/super-admin/finance/tenants/${id}/classes`);
    setClasses(Array.isArray(data) ? data : []);
  }, []);

  const searchStudents = useCallback(async (id: number, q: string) => {
    const data = await apiService.get<StudentRow[]>(
      `/super-admin/finance/tenants/${id}/students?q=${encodeURIComponent(q)}`
    );
    setStudents(Array.isArray(data) ? data : []);
  }, []);

  const refreshMeta = useCallback(async () => {
    if (!tenantId) return;
    setLoadingMeta(true);
    try {
      await Promise.all([loadTerms(tenantId), loadClasses(tenantId), searchStudents(tenantId, studentQuery)]);
    } catch (err: unknown) {
      toast({
        title: 'Could not load school data',
        description: err instanceof Error ? err.message : 'Failed to load terms, classes, or students',
        variant: 'destructive',
      });
    } finally {
      setLoadingMeta(false);
    }
  }, [tenantId, studentQuery, loadTerms, loadClasses, searchStudents]);

  const loadDeletePreview = useCallback(async (schoolId: number, ledgerId: number) => {
    setPreviewLoading(true);
    setPreview(null);
    try {
      const data = await apiService.get<TermDeletePreview>(
        `/super-admin/finance/tenants/${schoolId}/terms/${ledgerId}/delete-preview`
      );
      setPreview(data);
    } catch (err: unknown) {
      toast({
        title: 'Could not load term preview',
        description: err instanceof Error ? err.message : 'Failed to load linked finance data',
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setTermId(null);
    setDeleteTermId(null);
    setPreview(null);
    setClassId(null);
    setStudentId(null);
    void refreshMeta();
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (tenantId) void searchStudents(tenantId, studentQuery);
    }, 300);
    return () => window.clearTimeout(t);
  }, [studentQuery, tenantId, searchStudents]);

  useEffect(() => {
    if (!tenantId || !deleteTermId) {
      setPreview(null);
      return;
    }
    void loadDeletePreview(tenantId, deleteTermId);
  }, [tenantId, deleteTermId, loadDeletePreview]);

  const resetConfirmState = () => {
    setConfirmPhrase('');
    setUnderstandChecked(false);
  };

  const resetDeleteConfirmState = () => {
    setDeletePhrase('');
    setDeleteUnderstood(false);
  };

  const handleOpenConfirm = () => {
    resetConfirmState();
    setConfirmOpen(true);
  };

  const handleWipe = async () => {
    if (!tenantId || !termId || !canConfirmWipe) return;
    setWiping(true);
    try {
      const result = await apiService.delete<WipeResult>('/super-admin/finance/wipe', {
        tenant_id: tenantId,
        term_id: termId,
        scope,
        student_id: scope === 'student' ? studentId ?? undefined : undefined,
        class_id: scope === 'class' ? classId ?? undefined : undefined,
      });
      setLastResult(result);
      setConfirmOpen(false);
      resetConfirmState();
      setSuccessOpen(true);
      toast({
        title: 'Finance wipe completed',
        description: `${result.wiped.ledgerRowsDeleted} ledger row(s) and ${result.wiped.paymentRowsDeleted} payment(s) removed.`,
      });
      if (deleteTermId === termId) void loadDeletePreview(tenantId, termId);
      await loadTerms(tenantId);
    } catch (err: unknown) {
      toast({
        title: 'Wipe failed',
        description: err instanceof Error ? err.message : 'Could not complete finance wipe',
        variant: 'destructive',
      });
    } finally {
      setWiping(false);
    }
  };

  const handleDeleteAndReset = async () => {
    if (!tenantId || !deleteTermId || !canConfirmDelete) return;
    setDeleting(true);
    try {
      const result = await apiService.delete<TermDeleteResult>(
        `/super-admin/finance/tenants/${tenantId}/terms/${deleteTermId}`,
        { confirm: 'DELETE TERM' }
      );
      setDeleteResult(result);
      setDeleteConfirmOpen(false);
      resetDeleteConfirmState();
      setDeleteSuccessOpen(true);
      setDeleteTermId(null);
      setPreview(null);
      await loadTerms(tenantId);
      toast({
        title: 'Term permanently deleted',
        description: `Ledger #${result.deletedLedgerTermId} and all its finance data were wiped. No replacement ledger was created.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Could not delete term finance',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleForceClose = async (ledgerTermId: number) => {
    if (!tenantId) return;
    setForceClosingId(ledgerTermId);
    try {
      const result = await apiService.post<{
        termLabel: string;
        feeStructuresArchived: number;
      }>(`/super-admin/finance/tenants/${tenantId}/terms/${ledgerTermId}/force-close`, {});
      await loadTerms(tenantId);
      toast({
        title: 'Term force-closed',
        description: `${result.termLabel} is now closed. Fee structures archived: ${result.feeStructuresArchived}.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Force close failed',
        description: err instanceof Error ? err.message : 'Could not force-close term',
        variant: 'destructive',
      });
    } finally {
      setForceClosingId(null);
    }
  };

  const scopeLabel =
    scope === 'school'
      ? 'Entire school'
      : scope === 'class'
        ? selectedClass?.name || 'One class'
        : selectedStudent
          ? `${selectedStudent.last_name}, ${selectedStudent.first_name}`
          : 'One student';

  const previewLinksWithData = preview?.links.filter((l) => l.count > 0) ?? [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-outfit text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Finance Configuration
          </h3>
          <p className="max-w-2xl text-sm font-medium text-slate-500">
            Super-admin tools to inspect, wipe, or fully delete &amp; reset a term’s finance ledger — without
            touching students or non-term finance.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void refreshMeta()}
          disabled={!tenantId || loadingMeta}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loadingMeta && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-red-200/80 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/25">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-bold text-red-800 dark:text-red-200">Destructive operations</p>
            <p className="text-xs leading-relaxed text-red-700/90 dark:text-red-300/85">
              Delete removes the ledger term by id and all of its finance permanently — no replacement ledger is
              created. Students, classes, staff, grades, and other terms’ finance are never deleted. Terms are
              identified by id and date range, not by display name.
            </p>
          </div>
        </div>
      </div>

      {/* School picker */}
      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className={dialogLabelClass}>School</Label>
            <Select
              value={tenantId != null ? String(tenantId) : ''}
              onValueChange={(v) => setTenantId(v ? Number(v) : null)}
            >
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select school…" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    #{s.id} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedSchool ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedSchool.name}</span>
              <span className="ml-2 text-muted-foreground">Tenant #{selectedSchool.id}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* DELETE & RESET — primary powerful tool */}
      {tenantId ? (
        <Card className="border-red-200/90 shadow-sm dark:border-red-900/50">
          <CardHeader className="border-b border-red-100 dark:border-red-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-outfit text-lg font-black">Delete term completely</CardTitle>
                <CardDescription>
                  Preview every finance record linked to a ledger term by id, then permanently wipe that term and all
                  of its finance from the database. No replacement ledger is created.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label className={dialogLabelClass}>Ledger term to delete</Label>
              <Select
                value={deleteTermId != null ? String(deleteTermId) : ''}
                onValueChange={(v) => setDeleteTermId(v ? Number(v) : null)}
                disabled={loadingMeta}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder={loadingMeta ? 'Loading terms…' : 'Select term…'} />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t) => {
                    const badge = termStatusBadge(t.status, t.is_current);
                    return (
                      <SelectItem key={t.id} value={String(t.id)}>
                        #{t.id} · {t.name} — {t.academic_year} ({badge.label})
                        {t.ledger_rows ? ` · ${t.ledger_rows} ledger rows` : ''}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {previewLoading ? (
              <BrandedLoading label="Scanning finance linked to this term…" className="py-10" />
            ) : preview ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <Database className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold">
                    #{preview.ledgerTermId} · {preview.termName} · {preview.academicYear}
                  </span>
                  {preview.startDate && preview.endDate ? (
                    <span className="text-xs text-muted-foreground">
                      {preview.startDate} → {preview.endDate}
                    </span>
                  ) : null}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] font-bold uppercase',
                      termStatusBadge(preview.status, preview.isCurrent).className
                    )}
                  >
                    {termStatusBadge(preview.status, preview.isCurrent).label}
                  </Badge>
                  {preview.academicTerms.some((a) => a.isActive) ? (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] font-bold uppercase text-emerald-700">
                      Active academic
                    </Badge>
                  ) : null}
                </div>

                {preview.blockReason ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    {preview.blockReason}
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {[
                    { label: 'Students billed', value: String(preview.totals.studentsWithLedger) },
                    { label: 'Ledger debits', value: money(preview.totals.totalDebits) },
                    { label: 'Payments', value: money(preview.totals.paymentsAmount) },
                    { label: 'Net balance', value: money(preview.totals.netBalance) },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{stat.label}</p>
                      <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{stat.value}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl border border-red-200/70 bg-red-50/40 dark:border-red-900/40 dark:bg-red-950/20">
                  <div className="flex items-center gap-2 border-b border-red-200/60 px-4 py-3 dark:border-red-900/40">
                    <Eye className="h-4 w-4 text-red-600" />
                    <p className="text-xs font-bold uppercase tracking-widest text-red-700 dark:text-red-300">
                      Finance linked to this term (will be deleted)
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-red-100/80 dark:divide-red-900/30">
                    {(previewLinksWithData.length ? previewLinksWithData : preview.links).map((link) => (
                      <div key={link.key} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{link.label}</p>
                          {link.note ? (
                            <p className="text-xs text-muted-foreground">{link.note}</p>
                          ) : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-bold tabular-nums">{link.count.toLocaleString()}</p>
                          {link.amount > 0 ? (
                            <p className="text-xs text-muted-foreground">{money(link.amount)}</p>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {preview.academicTerms.length > 0 ? (
                  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                      Linked academic terms (will be unlinked &amp; archived)
                    </p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {preview.academicTerms.map((a) => (
                        <li key={a.id}>
                          #{a.id} · {a.termName} {a.year}
                          {a.isActive ? ' · active' : ''}
                          {a.closedAt ? ' · was closed' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
                    Preserved (not deleted)
                  </p>
                  <ul className="mt-2 grid gap-1 text-xs text-emerald-900/90 dark:text-emerald-100/90 sm:grid-cols-2">
                    {preview.preserved.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  variant="destructive"
                  className="h-11 w-full rounded-xl font-bold text-xs uppercase tracking-widest"
                  disabled={!preview.canDelete || previewLoading}
                  onClick={() => {
                    resetDeleteConfirmState();
                    setDeleteConfirmOpen(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Review &amp; permanently delete
                </Button>
              </div>
            ) : selectedDeleteTerm ? null : (
              <p className="text-sm text-muted-foreground">
                Select a ledger term to see every finance record linked to it before deleting.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tenantId ? (
        <Card className="border-amber-200/80 bg-amber-50/40 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/15">
          <CardHeader className="border-b border-amber-200/60 pb-4 dark:border-amber-900/40">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="font-outfit text-lg font-black">Force close unused terms</CardTitle>
                <CardDescription>
                  Lock open ledger terms that are no longer in use. Does not delete finance data.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            {loadingMeta ? (
              <BrandedLoading label="Loading terms…" className="py-6" />
            ) : forceCloseableTerms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No unused open terms for this school.
              </p>
            ) : (
              <div className="space-y-2">
                {forceCloseableTerms.map((t) => {
                  const badge = termStatusBadge(t.status, t.is_current);
                  const closing = forceClosingId === t.id;
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col gap-3 rounded-xl border border-amber-200/70 bg-white/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-900/40 dark:bg-slate-950/40"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          #{t.id} · {t.name} · {t.academic_year}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', badge.className)}>
                            {badge.label}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200"
                        disabled={closing || forceClosingId != null}
                        onClick={() => void handleForceClose(t.id)}
                      >
                        {closing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Closing…
                          </>
                        ) : (
                          <>
                            <Lock className="mr-2 h-4 w-4" />
                            Force close
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Scoped wipe (existing) */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="font-outfit text-lg font-black">Scoped finance wipe</CardTitle>
                  <CardDescription>
                    Remove finance rows for a term without deleting the ledger term itself (school / class / student).
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label className={dialogLabelClass}>Term</Label>
                <Select
                  value={termId != null ? String(termId) : ''}
                  onValueChange={(v) => setTermId(v ? Number(v) : null)}
                  disabled={!tenantId || loadingMeta}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder={loadingMeta ? 'Loading terms…' : 'Select term…'} />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((t) => {
                      const badge = termStatusBadge(t.status, t.is_current);
                      return (
                        <SelectItem key={t.id} value={String(t.id)}>
                          #{t.id} · {t.name} — {t.academic_year} ({badge.label})
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedTerm ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/50">
                  <CalendarRange className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {selectedTerm.name} · {selectedTerm.academic_year}
                  </span>
                </div>
              ) : null}

              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as 'school' | 'class' | 'student')}
                className="grid gap-3"
              >
                {SCOPE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const selected = scope === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all',
                        selected
                          ? 'border-emerald-300 bg-emerald-50/60 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/25'
                          : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700'
                      )}
                    >
                      <RadioGroupItem value={opt.value} id={`wipe-scope-${opt.value}`} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{opt.label}</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{opt.description}</p>
                      </div>
                    </label>
                  );
                })}
              </RadioGroup>

              {scope === 'class' ? (
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Class</Label>
                  <Select
                    value={classId != null ? String(classId) : ''}
                    onValueChange={(v) => setClassId(v ? Number(v) : null)}
                    disabled={!tenantId || loadingMeta}
                  >
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {scope === 'student' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className={dialogLabelClass}>Search student</Label>
                    <Input
                      value={studentQuery}
                      onChange={(e) => setStudentQuery(e.target.value)}
                      placeholder="Name or admission number"
                      disabled={!tenantId}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={dialogLabelClass}>Student</Label>
                    <Select
                      value={studentId != null ? String(studentId) : ''}
                      onValueChange={(v) => setStudentId(v ? Number(v) : null)}
                      disabled={!tenantId || loadingMeta}
                    >
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue placeholder="Select student…" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No students found
                          </SelectItem>
                        ) : (
                          students.map((s) => (
                            <SelectItem key={s.id} value={String(s.id)}>
                              {s.last_name}, {s.first_name}
                              {s.admission_number ? ` (${s.admission_number})` : ''}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 xl:sticky xl:top-4">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="font-outfit text-lg font-black">Scoped wipe review</CardTitle>
              <CardDescription>Keeps the ledger term row; only deletes finance rows.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">
              <div className={dialogSectionClass}>
                <DetailField label="School">
                  {selectedSchool ? `#${selectedSchool.id} — ${selectedSchool.name}` : 'Not selected'}
                </DetailField>
                <DetailField label="Term">
                  {selectedTerm ? `${selectedTerm.name} · ${selectedTerm.academic_year}` : 'Not selected'}
                </DetailField>
                <DetailField label="Scope">{scopeLabel}</DetailField>
              </div>
              <Button
                variant="destructive"
                className="h-11 w-full rounded-xl font-bold text-xs uppercase tracking-widest"
                disabled={!canOpenConfirm}
                onClick={handleOpenConfirm}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Open wipe confirmation
              </Button>
            </CardContent>
          </Card>

          {lastResult ? (
            <Card className="border-emerald-200/80 bg-emerald-50/50 shadow-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-black font-outfit text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  Last scoped wipe
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p>Ledger rows: <strong>{lastResult.wiped.ledgerRowsDeleted}</strong></p>
                <p>Payments: <strong>{lastResult.wiped.paymentRowsDeleted}</strong></p>
                <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={() => setSuccessOpen(true)}>
                  View summary
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Delete & reset confirmation */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          setDeleteConfirmOpen(open);
          if (!open) resetDeleteConfirmState();
        }}
      >
        <DialogContent className={cn(destructiveDialogClass, 'max-w-xl')}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3 text-red-800 dark:text-red-200')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Delete term completely
            </DialogTitle>
            <DialogDescription className="text-sm">
              This permanently deletes all finance for this ledger term and removes the term row. Nothing is
              recreated.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            {preview ? (
              <>
                <div className={dialogSectionClass}>
                  <DetailField label="School">{selectedSchool?.name}</DetailField>
                  <DetailField label="Term">
                    #{preview.ledgerTermId} · {preview.termName} — {preview.academicYear}
                  </DetailField>
                  <DetailField label="Students with ledger">{preview.totals.studentsWithLedger}</DetailField>
                  <DetailField label="Payments">{money(preview.totals.paymentsAmount)}</DetailField>
                  <DetailField label="Net balance">{money(preview.totals.netBalance)}</DetailField>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-xl border border-red-200/80 bg-red-50/60 p-3 text-xs dark:border-red-900/50 dark:bg-red-950/30">
                  {previewLinksWithData.map((l) => (
                    <div key={l.key} className="flex justify-between gap-2 py-0.5">
                      <span>{l.label}</span>
                      <span className="font-semibold tabular-nums">{l.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : null}

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <Checkbox
                checked={deleteUnderstood}
                onCheckedChange={(v) => setDeleteUnderstood(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                I understand this permanently deletes all term finance and removes ledger #{preview?.ledgerTermId}{' '}
                with no replacement. Students and other terms are not deleted.
              </span>
            </label>

            <div className="space-y-2">
              <Label className={dialogLabelClass}>Type confirmation phrase</Label>
              <p className="rounded-xl border border-red-200/80 bg-white/80 px-3 py-2 font-mono text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-slate-950/60 dark:text-red-300">
                {deleteRequiredPhrase}
              </p>
              <Input
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                placeholder="Type the phrase exactly"
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-xl font-mono"
              />
            </div>
          </DialogBody>

          <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row')}>
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full rounded-xl font-bold sm:w-auto"
              disabled={!canConfirmDelete}
              onClick={() => void handleDeleteAndReset()}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Permanently delete term
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete success */}
      <Dialog open={deleteSuccessOpen} onOpenChange={setDeleteSuccessOpen}>
        <DialogContent className={successDialogClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              Term deleted
            </DialogTitle>
            <DialogDescription>
              Finance wiped and the ledger term removed. No new ledger was created.
            </DialogDescription>
          </DialogHeader>
          {deleteResult ? (
            <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
              <div className="rounded-xl border p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Deleted term id</p>
                <p className="mt-1 text-2xl font-black">#{deleteResult.deletedLedgerTermId}</p>
              </div>
              <p className="text-sm">
                <strong>{deleteResult.termLabel}</strong> · {deleteResult.academicYear}
              </p>
              <p className="text-xs text-muted-foreground">
                Academic terms unlinked/archived: {deleteResult.academicTermsUnlinked}. Create a new term in Settings
                when you are ready to start again.
              </p>
            </DialogBody>
          ) : null}
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="primaryAction" className="rounded-xl font-bold" onClick={() => setDeleteSuccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scoped wipe confirmation */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open);
          if (!open) resetConfirmState();
        }}
      >
        <DialogContent className={destructiveDialogClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3 text-red-800 dark:text-red-200')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                <AlertTriangle className="h-5 w-5" />
              </span>
              Permanent finance wipe
            </DialogTitle>
            <DialogDescription className="text-sm">
              Deletes finance rows for the selected scope. The ledger term itself remains.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div className={dialogSectionClass}>
              <DetailField label="School">{selectedSchool?.name}</DetailField>
              <DetailField label="Term">
                {selectedTerm ? `${selectedTerm.name} — ${selectedTerm.academic_year}` : '—'}
              </DetailField>
              <DetailField label="Scope">{scopeLabel}</DetailField>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <Checkbox
                checked={understandChecked}
                onCheckedChange={(v) => setUnderstandChecked(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                I understand this permanently deletes finance data for the selected scope.
              </span>
            </label>

            <div className="space-y-2">
              <Label className={dialogLabelClass}>Type confirmation phrase</Label>
              <p className="rounded-xl border border-red-200/80 bg-white/80 px-3 py-2 font-mono text-xs font-semibold text-red-700 dark:border-red-900/50 dark:bg-slate-950/60 dark:text-red-300">
                {requiredPhrase || 'Select a term first'}
              </p>
              <Input
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="Type the phrase exactly"
                autoComplete="off"
                spellCheck={false}
                className="h-11 rounded-xl font-mono"
              />
            </div>
          </DialogBody>

          <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row')}>
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => setConfirmOpen(false)}
              disabled={wiping}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="w-full rounded-xl font-bold sm:w-auto"
              disabled={!canConfirmWipe}
              onClick={() => void handleWipe()}
            >
              {wiping ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wiping…
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Permanently wipe
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent className={successDialogClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              Wipe completed
            </DialogTitle>
          </DialogHeader>
          {lastResult ? (
            <DialogBody className={cn(detailDialogBodyClass, 'space-y-2 text-sm')}>
              <p>Students affected: <strong>{lastResult.wiped.studentsAffected}</strong></p>
              <p>Ledger rows: <strong>{lastResult.wiped.ledgerRowsDeleted}</strong></p>
              <p>Payments: <strong>{lastResult.wiped.paymentRowsDeleted}</strong></p>
              <p>Fee structures: <strong>{lastResult.wiped.feeStructureRowsDeleted}</strong></p>
            </DialogBody>
          ) : null}
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="primaryAction" className="rounded-xl font-bold" onClick={() => setSuccessOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminFinanceWipeModule;
