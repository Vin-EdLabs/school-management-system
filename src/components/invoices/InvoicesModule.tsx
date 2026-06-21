import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText,
  Loader2,
  Printer,
  FileDown,
  Users,
  User,
  Sparkles,
  Archive,
  Search,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useData } from '@/contexts/DataContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import { isActiveEnrolledStudent } from '../students/studentRegistryUtils';
import {
  listInvoices,
  generateInvoice,
  generateBulkInvoices,
  fetchInvoicePdfData,
  invoiceStatusLabel,
  invoiceStatusClass,
  type Invoice,
  type InvoicePdfPayload,
} from '@/services/invoiceApi';
import InvoiceDocument from './InvoiceDocument';
import InvoiceListItem from './InvoiceListItem';
import {
  downloadInvoicePayload,
  printInvoicePayload,
  downloadInvoicesZipFromPayloads,
} from './invoiceExportUtils';
import { cn } from '@/lib/utils';

type GenerateMode = 'single' | 'class';

type PickerStudent = {
  id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  classAssigned: string;
};

const InvoicesModule: React.FC = () => {
  const { classes, students } = useData();
  const { currentTerm, activeAcademicTermId } = useActiveTerm();

  const [selectedClass, setSelectedClass] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [previewInvoices, setPreviewInvoices] = useState<Invoice[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [previewPayload, setPreviewPayload] = useState<InvoicePdfPayload | null>(null);
  const [loadingPreviewDoc, setLoadingPreviewDoc] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | 'all' | 'bulk' | null>(null);

  const [generateMode, setGenerateMode] = useState<GenerateMode>('class');
  const [genStudent, setGenStudent] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [generating, setGenerating] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [listSearch, setListSearch] = useState('');

  const selectedClassName = classes.find((c) => c.id === selectedClass)?.className;

  const classStudents = useMemo((): PickerStudent[] => {
    if (!selectedClass) return [];
    const className = selectedClassName || '';

    const roster = students
      .filter(isActiveEnrolledStudent)
      .filter(
        (s) =>
          String(s.classAssignedId) === selectedClass ||
          (!!className && s.classAssigned === className)
      )
      .map((s) => ({
        id: s.id,
        firstName: s.firstName,
        lastName: s.lastName,
        studentId: s.studentId,
        classAssigned: s.classAssigned,
      }));

    const seen = new Set(roster.map((s) => s.id));
    for (const inv of previewInvoices) {
      const sid = String(inv.studentId);
      if (seen.has(sid)) continue;
      seen.add(sid);
      const nameParts = (inv.studentName || 'Student').trim().split(/\s+/);
      roster.push({
        id: sid,
        firstName: nameParts[0] || 'Student',
        lastName: nameParts.slice(1).join(' ') || '',
        studentId: inv.studentCode || '',
        classAssigned: inv.className || className,
      });
    }

    return roster.sort((a, b) =>
      `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
    );
  }, [students, selectedClass, selectedClassName, previewInvoices]);

  const filteredStudentsForPick = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    if (!q) return classStudents;
    return classStudents.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        String(s.studentId || '').toLowerCase().includes(q)
    );
  }, [classStudents, studentSearch]);

  const selectedStudentObj = classStudents.find((s) => s.id === genStudent) ?? null;

  const selectedInvoice = previewInvoices.find((i) => i.id === selectedId) ?? null;

  const filteredInvoices = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    let items = previewInvoices;
    if (q) {
      items = items.filter(
        (inv) =>
          (inv.studentName || '').toLowerCase().includes(q) ||
          (inv.studentCode || '').toLowerCase().includes(q) ||
          (inv.className || '').toLowerCase().includes(q) ||
          inv.invoiceNumber.toLowerCase().includes(q)
      );
    }
    return items;
  }, [previewInvoices, listSearch]);

  const loadClassPreviews = useCallback(async (classOverride?: string) => {
    const classId = classOverride ?? selectedClass;
    if (!classId) {
      setPreviewInvoices([]);
      setSelectedId(null);
      setPreviewPayload(null);
      return [];
    }
    setLoadingPreview(true);
    try {
      const listParams = {
        classId: Number(classId),
        status: filterStatus !== 'all' ? filterStatus : undefined,
        limit: 200,
        offset: 0,
      };

      let res = await listInvoices({
        ...listParams,
        termId: activeAcademicTermId ?? undefined,
      });

      // Fallback: if term filter returns nothing, retry without term (class-only)
      if (res.items.length === 0 && activeAcademicTermId) {
        res = await listInvoices(listParams);
      }

      setPreviewInvoices(res.items);
      setSelectedId((prev) => {
        if (res.items.length === 0) return null;
        if (prev != null && res.items.some((i) => i.id === prev)) return prev;
        return res.items[0].id;
      });
      if (res.items.length === 0) setPreviewPayload(null);
      return res.items;
    } catch {
      toast.error('Could not load invoices for this class');
      setPreviewInvoices([]);
      return [];
    } finally {
      setLoadingPreview(false);
    }
  }, [activeAcademicTermId, selectedClass, filterStatus]);

  useEffect(() => {
    void loadClassPreviews();
  }, [loadClassPreviews]);

  const handleClassChange = (classId: string) => {
    setSelectedClass(classId);
    setGenStudent('');
    setStudentSearch('');
    setListSearch('');
    setSelectedId(null);
  };

  useEffect(() => {
    if (!genStudent || previewInvoices.length === 0) return;
    const inv = previewInvoices.find((i) => String(i.studentId) === genStudent);
    if (inv) setSelectedId(inv.id);
  }, [genStudent, previewInvoices]);

  useEffect(() => {
    if (filteredInvoices.length === 0) return;
    setSelectedId((prev) =>
      prev != null && filteredInvoices.some((i) => i.id === prev) ? prev : filteredInvoices[0].id
    );
  }, [filteredInvoices]);

  useEffect(() => {
    if (!selectedId) {
      setPreviewPayload(null);
      return;
    }
    let cancelled = false;
    setLoadingPreviewDoc(true);
    void fetchInvoicePdfData(selectedId)
      .then((data) => {
        if (!cancelled) setPreviewPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPreviewPayload(null);
          toast.error('Could not load invoice preview');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreviewDoc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const previewStats = useMemo(() => {
    const total = previewInvoices.reduce(
      (s, i) => s + (i.outstanding ?? i.totalDue),
      0
    );
    return { count: previewInvoices.length, total };
  }, [previewInvoices]);

  const runSingleGenerate = async () => {
    if (!genStudent) {
      toast.error('Select a student');
      return;
    }
    setGenerating(true);
    try {
      const inv = await generateInvoice({
        student_id: Number(genStudent),
        term_id: activeAcademicTermId ?? undefined,
        due_date: dueDate || undefined,
      });
      toast.success(
        inv.refreshed
          ? `Invoice ${inv.invoiceNumber} updated from live ledger`
          : `Invoice ${inv.invoiceNumber} created`
      );
      setSelectedId(inv.id);
      await loadClassPreviews(selectedClass);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not generate invoice');
    } finally {
      setGenerating(false);
    }
  };

  const runClassGenerate = async () => {
    if (!selectedClass) {
      toast.error('Select a class');
      return;
    }
    setGenerating(true);
    try {
      const summary = await generateBulkInvoices({
        term_id: activeAcademicTermId ?? undefined,
        class_id: Number(selectedClass),
        due_date: dueDate || undefined,
      });
      if (summary.generated > 0) {
        toast.success(
          `${summary.generated} invoice(s) generated${summary.skipped ? ` · ${summary.skipped} already existed` : ''}`
        );
      } else if (summary.skipped > 0) {
        toast.info(`${summary.skipped} invoice(s) already exist for this class — showing below`);
      } else {
        toast.warning('No invoices generated. Students may have zero balance or no fees set.');
      }

      const loaded = await loadClassPreviews(selectedClass);
      const fromBulk = [...summary.invoices, ...(summary.existingInvoices ?? [])];
      if (loaded.length === 0 && fromBulk.length > 0) {
        setPreviewInvoices(fromBulk);
        setSelectedId(fromBulk[0].id);
      } else if (fromBulk.length > 0) {
        setSelectedId(fromBulk[0].id);
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Bulk generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const withInvoiceAction = async (
    invoice: Invoice,
    action: 'print' | 'pdf',
    key: number | 'all'
  ) => {
    setActionLoading(key);
    try {
      const data = await fetchInvoicePdfData(invoice.id);
      if (action === 'print') await printInvoicePayload(data);
      else await downloadInvoicePayload(data);
    } catch {
      toast.error(action === 'print' ? 'Print failed' : 'PDF download failed');
    } finally {
      setActionLoading(null);
    }
  };

  const printAllClass = async () => {
    if (!previewInvoices.length) return;
    setActionLoading('all');
    try {
      for (const inv of previewInvoices) {
        const data = await fetchInvoicePdfData(inv.id);
        await printInvoicePayload(data);
        await new Promise((r) => setTimeout(r, 600));
      }
      toast.success('Sent all invoices to print');
    } catch {
      toast.error('Print failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadAllZip = async () => {
    if (!previewInvoices.length) return;
    setActionLoading('bulk');
    try {
      const payloads = await Promise.all(previewInvoices.map((i) => fetchInvoicePdfData(i.id)));
      await downloadInvoicesZipFromPayloads(payloads);
      toast.success('ZIP downloaded');
    } catch {
      toast.error('Could not create ZIP');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 md:p-8 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:via-slate-900 dark:to-violet-950/30">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Invoices</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Formal fee bills · {currentTerm || 'Current term'}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-xl mt-3">
              Generate invoices for one student or an entire class, preview every bill, then print or export to PDF.
            </p>
          </div>
          {selectedClass && previewInvoices.length > 0 && (
            <div className="flex gap-4 shrink-0">
              <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/50 px-4 py-3 text-center min-w-[100px]">
                <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{previewStats.count}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Invoices</p>
              </div>
              <div className="rounded-xl bg-white/80 dark:bg-slate-900/60 border border-indigo-100 dark:border-indigo-900/50 px-4 py-3 text-center min-w-[120px]">
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                  GHS {previewStats.total.toLocaleString()}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Balance due</p>
              </div>
            </div>
          )}
        </div>
        <Sparkles className="absolute -right-4 -top-4 h-32 w-32 text-indigo-200/40 dark:text-indigo-800/20 pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Generate panel */}
        <Card className="xl:col-span-4 overflow-visible rounded-2xl border-slate-200 shadow-sm dark:border-slate-700">
          <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-800/40 pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Generate invoice
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-5">
            <Tabs value={generateMode} onValueChange={(v) => setGenerateMode(v as GenerateMode)}>
              <TabsList className="grid w-full grid-cols-2 rounded-xl h-10">
                <TabsTrigger value="single" className="rounded-lg gap-1.5 text-xs sm:text-sm">
                  <User className="h-3.5 w-3.5" /> One student
                </TabsTrigger>
                <TabsTrigger value="class" className="rounded-lg gap-1.5 text-xs sm:text-sm">
                  <Users className="h-3.5 w-3.5" /> Whole class
                </TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Class</Label>
                  <Select value={selectedClass} onValueChange={handleClassChange}>
                    <SelectTrigger className="h-11 rounded-xl">
                      <SelectValue placeholder="Select class…" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="rounded-lg">
                          {c.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedClass && !loadingPreview && (
                    <p className="text-xs text-muted-foreground">
                      {previewInvoices.length > 0
                        ? `${previewInvoices.length} invoice(s) ready to preview, print, or export`
                        : 'No invoices yet — use the button below to generate'}
                    </p>
                  )}
                </div>

                {generateMode === 'single' && (
                  <div className="space-y-2">
                    <Label>Student</Label>
                    {!selectedClass ? (
                      <p className="text-xs text-muted-foreground py-2">Choose a class first.</p>
                    ) : classStudents.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No active students in this class.</p>
                    ) : (
                      <>
                        {selectedStudentObj ? (
                          <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-200 bg-indigo-50/60 dark:border-indigo-900/50 dark:bg-indigo-950/30 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {selectedStudentObj.firstName} {selectedStudentObj.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {selectedStudentObj.studentId} · {selectedStudentObj.classAssigned}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 text-xs"
                              onClick={() => {
                                setGenStudent('');
                                setStudentSearch('');
                              }}
                            >
                              Change
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                              <Input
                                placeholder="Search name or ID…"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                                className="h-10 pl-9 rounded-xl"
                              />
                            </div>
                            <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 shadow-sm">
                              {filteredStudentsForPick.length === 0 ? (
                                <p className="px-3 py-4 text-center text-sm text-muted-foreground">No students match your search</p>
                              ) : (
                                filteredStudentsForPick.map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    className="flex w-full items-center border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-indigo-50 dark:border-slate-800 dark:hover:bg-indigo-950/40 transition-colors"
                                    onClick={() => {
                                      setGenStudent(s.id);
                                      setStudentSearch('');
                                      setListSearch(`${s.firstName} ${s.lastName}`.trim());
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-foreground truncate">
                                        {s.firstName} {s.lastName}
                                      </p>
                                      <p className="text-xs text-muted-foreground truncate">{s.studentId}</p>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground">
                              {classStudents.length} student{classStudents.length !== 1 ? 's' : ''} in this class — tap to select
                            </p>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Due date (optional)</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <TabsContent value="single" className="mt-0">
                  <Button
                    className="w-full h-11 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700"
                    disabled={generating || !selectedClass || !genStudent}
                    onClick={() => void runSingleGenerate()}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    Generate for student
                  </Button>
                </TabsContent>
                <TabsContent value="class" className="mt-0">
                  <Button
                    className="w-full h-11 rounded-xl gap-2 bg-indigo-600 hover:bg-indigo-700"
                    disabled={generating || !selectedClass}
                    onClick={() => void runClassGenerate()}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                    Generate for entire class
                  </Button>
                </TabsContent>
              </div>
            </Tabs>
          </CardContent>
        </Card>

        {/* Preview panel — compact list + large document */}
        <div className="xl:col-span-8 min-h-0">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-700 h-full flex flex-col">
            <CardHeader className="border-b bg-slate-50/80 dark:bg-slate-800/40 pb-4 shrink-0">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Invoice preview</CardTitle>
                    {selectedClassName && (
                      <p className="text-sm text-muted-foreground mt-0.5">{selectedClassName}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[130px] h-9 rounded-lg">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="issued">Issued</SelectItem>
                        <SelectItem value="partially_paid">Partial</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => void loadClassPreviews()}>
                      <RefreshCw className={cn('h-4 w-4', loadingPreview && 'animate-spin')} />
                    </Button>
                  </div>
                </div>
                {selectedClass && previewInvoices.length > 0 && (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search student name, ID, or class…"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      className="h-10 pl-9 rounded-xl bg-white dark:bg-slate-900"
                    />
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 flex flex-col min-h-[520px]">
              {!selectedClass ? (
                <div className="py-20 text-center px-4">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-600 dark:text-slate-400">Select a class to preview invoices</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Pick a class on the left — students appear in the list, tap one for a full preview.
                  </p>
                </div>
              ) : loadingPreview ? (
                <div className="py-20 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : previewInvoices.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-600">No invoices for this class yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Generate invoices using the panel on the left.
                  </p>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="py-20 text-center px-4">
                  <Search className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <p className="font-medium text-slate-600">No students match your search</p>
                  <Button variant="link" className="mt-2" onClick={() => setListSearch('')}>
                    Clear search
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row flex-1 min-h-0">
                  {/* Compact student list */}
                  <div className="lg:w-[240px] xl:w-[260px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50/80 dark:bg-slate-900/40">
                    <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {filteredInvoices.length} student{filteredInvoices.length !== 1 ? 's' : ''}
                    </div>
                    <div className="overflow-y-auto max-h-[220px] lg:max-h-none lg:flex-1">
                      {filteredInvoices.map((inv) => (
                        <InvoiceListItem
                          key={inv.id}
                          invoice={inv}
                          selected={selectedId === inv.id}
                          onSelect={() => setSelectedId(inv.id)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Large preview */}
                  <div className="flex-1 flex flex-col min-w-0 min-h-[480px] lg:min-h-[600px]">
                    <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      {selectedInvoice && (
                        <>
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="font-semibold text-sm truncate">{selectedInvoice.studentName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{selectedInvoice.invoiceNumber}</p>
                          </div>
                          <Badge variant="outline" className={invoiceStatusClass(selectedInvoice.liveStatus || selectedInvoice.status)}>
                            {invoiceStatusLabel(selectedInvoice.liveStatus || selectedInvoice.status)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="rounded-lg gap-1.5"
                            disabled={actionLoading === selectedInvoice.id}
                            onClick={() => void withInvoiceAction(selectedInvoice, 'print', selectedInvoice.id)}
                          >
                            {actionLoading === selectedInvoice.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Print
                          </Button>
                          <Button
                            size="sm"
                            className="rounded-lg gap-1.5"
                            disabled={actionLoading === selectedInvoice.id}
                            onClick={() => void withInvoiceAction(selectedInvoice, 'pdf', selectedInvoice.id)}
                          >
                            <FileDown className="h-4 w-4" /> PDF
                          </Button>
                        </>
                      )}
                      <div className="flex gap-2 w-full sm:w-auto sm:ml-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1.5 flex-1 sm:flex-none"
                          disabled={actionLoading !== null}
                          onClick={() => void printAllClass()}
                        >
                          {actionLoading === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                          Print all
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1.5 flex-1 sm:flex-none"
                          disabled={actionLoading !== null}
                          onClick={() => void handleDownloadAllZip()}
                        >
                          {actionLoading === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                          ZIP all
                        </Button>
                      </div>
                    </div>

                    <div className="flex-1 overflow-auto bg-slate-200/60 dark:bg-slate-950/50 p-4 md:p-8">
                      {loadingPreviewDoc ? (
                        <div className="flex h-full min-h-[400px] items-center justify-center">
                          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                        </div>
                      ) : previewPayload ? (
                        <div className="mx-auto max-w-[820px] shadow-2xl rounded-lg overflow-hidden ring-1 ring-slate-200/80 dark:ring-slate-700">
                          <InvoiceDocument data={previewPayload} />
                        </div>
                      ) : (
                        <div className="flex h-full min-h-[400px] items-center justify-center text-muted-foreground">
                          Select a student from the list to preview their invoice
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

    </div>
  );
};

export default InvoicesModule;
