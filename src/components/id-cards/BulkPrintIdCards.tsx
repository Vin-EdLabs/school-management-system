import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  IdCard,
  Loader2,
  Printer,
  Search,
  Users,
  X,
  FileDown,
  Archive,
  GraduationCap,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/api';
import { useData } from '@/contexts/DataContext';
import { resolveLogoUrl } from '@/services/tenantService';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogHeader,
  DialogTitle,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
} from '@/components/ui/dialog';
import type { CardEntityType, IDCardSearchResult } from '@/types/idCard';
import {
  captureEntityCard,
  downloadBulkCardsPdf,
  downloadBulkCardsZip,
  printBulkCards,
  useDebouncedValue,
  type CapturedCard,
} from './idCardExport';
import BulkCardPreviewTile from './BulkCardPreviewTile';

type SelectionMode = 'class' | 'staff' | 'custom';

type PrintTarget = {
  key: string;
  id: number;
  type: CardEntityType;
  staffType?: 'teacher' | 'other';
  fullName: string;
  photoUrl: string | null;
  idNumber?: string;
  subtitle?: string;
};

type BulkPrintIdCardsProps = {
  onNavigate?: (module: string) => void;
};

const BulkPrintIdCards: React.FC<BulkPrintIdCardsProps> = ({ onNavigate }) => {
  const { classes, students, refresh } = useData();
  const [mode, setMode] = useState<SelectionMode>('class');
  const [classId, setClassId] = useState('');
  const [department, setDepartment] = useState('');
  const [staffRows, setStaffRows] = useState<IDCardSearchResult[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selected, setSelected] = useState<Map<string, PrintTarget>>(new Map());
  const [customQuery, setCustomQuery] = useState('');
  const debouncedCustomQuery = useDebouncedValue(customQuery, 300);
  const [customResults, setCustomResults] = useState<Array<IDCardSearchResult & { entityType: CardEntityType }>>([]);
  const [searchingCustom, setSearchingCustom] = useState(false);

  const [progressOpen, setProgressOpen] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '' });
  const cancelRef = useRef(false);

  const primaryColor = '#1a3a6b';

  useEffect(() => {
    void refresh(['students']);
  }, [refresh]);

  const classStudents = useMemo(() => {
    if (!classId) return [];
    return students.filter(
      (s) =>
        String(s.classAssignedId) === classId &&
        (!s.enrollmentStatus || s.enrollmentStatus === 'active')
    );
  }, [students, classId]);

  const classTargets: PrintTarget[] = useMemo(
    () =>
      classStudents.map((s) => ({
        key: `STUDENT-${s.id}`,
        id: Number(s.id),
        type: 'STUDENT' as const,
        fullName: `${s.firstName} ${s.lastName}`.trim(),
        photoUrl: s.passportPhotoUrl || null,
        idNumber: s.studentId,
        subtitle: s.classAssigned,
      })),
    [classStudents]
  );

  const loadStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const rows = await apiService.get<IDCardSearchResult[]>('/id-cards/search?type=staff&q=');
      setStaffRows(rows);
    } catch {
      toast.error('Could not load staff');
      setStaffRows([]);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'staff') void loadStaff();
  }, [mode, loadStaff]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    staffRows.forEach((r) => {
      if (r.department) set.add(r.department);
    });
    return ['', ...Array.from(set).sort()];
  }, [staffRows]);

  const filteredStaff = useMemo(() => {
    if (!department) return staffRows;
    return staffRows.filter((r) => r.department === department);
  }, [staffRows, department]);

  const staffTargets: PrintTarget[] = useMemo(
    () =>
      filteredStaff.map((r) => ({
        key: `STAFF-${r.id}-${r.staffType || 'teacher'}`,
        id: r.id,
        type: 'STAFF' as const,
        staffType: r.staffType || 'teacher',
        fullName: r.fullName,
        photoUrl: r.photoUrl,
        idNumber: r.idNumber,
        subtitle: r.department || r.position,
      })),
    [filteredStaff]
  );

  const listTargets = mode === 'class' ? classTargets : mode === 'staff' ? staffTargets : [];

  const listKeys = listTargets.map((t) => t.key);
  const selectedInList = listKeys.filter((k) => selected.has(k)).length;
  const allSelected = listTargets.length > 0 && selectedInList === listTargets.length;
  const someSelected = selectedInList > 0 && !allSelected;

  useEffect(() => {
    if (mode === 'class' && classTargets.length > 0) {
      setSelected(new Map(classTargets.map((t) => [t.key, t])));
    } else if (mode === 'class') {
      setSelected(new Map());
    }
  }, [mode, classId, classTargets]);

  useEffect(() => {
    if (mode === 'staff' && staffTargets.length > 0) {
      setSelected(new Map(staffTargets.map((t) => [t.key, t])));
    } else if (mode === 'staff') {
      setSelected(new Map());
    }
  }, [mode, department, staffTargets]);

  useEffect(() => {
    if (mode !== 'custom' || !debouncedCustomQuery.trim()) {
      setCustomResults([]);
      return;
    }
    setSearchingCustom(true);
    const q = encodeURIComponent(debouncedCustomQuery.trim());
    Promise.all([
      apiService.get<IDCardSearchResult[]>(`/id-cards/search?type=student&q=${q}`),
      apiService.get<IDCardSearchResult[]>(`/id-cards/search?type=staff&q=${q}`),
    ])
      .then(([studentsRes, staffRes]) =>
        setCustomResults([
          ...studentsRes.map((r) => ({ ...r, entityType: 'STUDENT' as const })),
          ...staffRes.map((r) => ({ ...r, entityType: 'STAFF' as const })),
        ])
      )
      .catch(() => setCustomResults([]))
      .finally(() => setSearchingCustom(false));
  }, [debouncedCustomQuery, mode]);

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (allSelected) listKeys.forEach((k) => next.delete(k));
      else listTargets.forEach((t) => next.set(t.key, t));
      return next;
    });
  };

  const toggleOne = (target: PrintTarget) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(target.key)) next.delete(target.key);
      else next.set(target.key, target);
      return next;
    });
  };

  const addCustom = (row: IDCardSearchResult & { entityType: CardEntityType }) => {
    const target: PrintTarget = {
      key:
        row.entityType === 'STUDENT'
          ? `STUDENT-${row.id}`
          : `STAFF-${row.id}-${row.staffType || 'teacher'}`,
      id: row.id,
      type: row.entityType,
      staffType: row.staffType,
      fullName: row.fullName,
      photoUrl: row.photoUrl,
      idNumber: row.idNumber,
      subtitle: row.entityType === 'STUDENT' ? row.className : row.department || row.position,
    };
    setSelected((prev) => new Map(prev).set(target.key, target));
    setCustomQuery('');
    setCustomResults([]);
  };

  const removeCustom = (key: string) => {
    setSelected((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  };

  const selectedList = useMemo(() => Array.from(selected.values()), [selected]);

  const previewTargets = mode === 'custom' ? selectedList : listTargets;

  const runBulkCapture = async (): Promise<CapturedCard[] | null> => {
    cancelRef.current = false;
    const targets = selectedList;
    if (targets.length === 0) return null;

    setProgressOpen(true);
    setProgress({ current: 0, total: targets.length, name: '' });

    const captured: CapturedCard[] = [];
    try {
      for (let i = 0; i < targets.length; i += 1) {
        if (cancelRef.current) return null;
        const t = targets[i];
        setProgress({ current: i, total: targets.length, name: t.fullName });
        const card = await captureEntityCard(t.type, t.id, t.staffType);
        captured.push(card);
        setProgress({ current: i + 1, total: targets.length, name: t.fullName });
      }
      return captured;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
      return null;
    } finally {
      setProgressOpen(false);
    }
  };

  const handlePrint = async () => {
    const cards = await runBulkCapture();
    if (!cards?.length) return;
    try {
      await printBulkCards(cards, true);
      toast.success(`${cards.length} cards (front & back) sent to print`);
    } catch {
      toast.error('Print failed');
    }
  };

  const handlePdf = async () => {
    const cards = await runBulkCapture();
    if (!cards?.length) return;
    downloadBulkCardsPdf(cards, true);
    toast.success(`${cards.length} cards exported with front & back pages`);
  };

  const handleZip = async () => {
    const cards = await runBulkCapture();
    if (!cards?.length) return;
    try {
      await downloadBulkCardsZip(cards);
      toast.success(`${cards.length} cards exported (Front + Back PNGs)`);
    } catch {
      toast.error('ZIP export failed');
    }
  };

  const actionPanel =
    selectedList.length > 0 ? (
      <Card className="mt-6 overflow-hidden rounded-2xl border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-white shadow-md dark:border-indigo-900/40 dark:from-indigo-950/30 dark:to-slate-900">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedList.length} card{selectedList.length === 1 ? '' : 's'} ready to print
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Exports include <strong>front and back</strong> for every selected card
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => void handlePrint()}>
              <Printer className="h-4 w-4" />
              Print all
            </Button>
            <Button className="rounded-xl gap-2 text-white" style={{ background: primaryColor }} onClick={() => void handlePdf()}>
              <FileDown className="h-4 w-4" />
              Download PDF
            </Button>
            <Button variant="secondary" className="rounded-xl gap-2" onClick={() => void handleZip()}>
              <Archive className="h-4 w-4" />
              Download ZIP
            </Button>
          </div>
        </CardContent>
      </Card>
    ) : null;

  const renderPreviewGrid = (targets: PrintTarget[], emptyMessage: string) => {
    if (targets.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center dark:border-slate-700 dark:bg-slate-900/30">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="font-medium text-slate-600 dark:text-slate-400">{emptyMessage}</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {mode !== 'custom' && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/40">
            <Checkbox
              checked={allSelected ? true : someSelected ? 'indeterminate' : false}
              onCheckedChange={toggleAll}
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {selectedInList} of {targets.length} selected
            </span>
            <Badge variant="outline" className="ml-auto text-xs">
              Front + Back preview
            </Badge>
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {targets.map((t) => (
            <BulkCardPreviewTile
              key={t.key}
              entityType={t.type}
              entityId={t.id}
              staffType={t.staffType}
              fullName={t.fullName}
              subtitle={t.subtitle}
              photoUrl={t.photoUrl}
              idNumber={t.idNumber}
              selected={selected.has(t.key)}
              showCheckbox={mode !== 'custom'}
              onToggle={mode !== 'custom' ? () => toggleOne(t) : undefined}
            />
          ))}
        </div>
      </div>
    );
  };

  const tabBtn = (id: SelectionMode, label: string, icon: React.ReactNode) => {
    const active = mode === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => {
          setMode(id);
          setSelected(new Map());
        }}
        className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all ${
          active
            ? 'text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
        }`}
        style={active ? { background: primaryColor } : undefined}
      >
        {icon}
        {label}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-6xl animate-in fade-in p-6 duration-500 md:p-8">
      <Button
        variant="ghost"
        className="mb-5 gap-2 rounded-xl px-0 text-slate-600 hover:bg-transparent hover:text-slate-900"
        onClick={() => onNavigate?.('id-cards')}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to ID Cards
      </Button>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-md"
              style={{ background: primaryColor }}
            >
              <IdCard className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Bulk Print ID Cards
            </h1>
          </div>
          <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
            Select a class or staff group, preview every card (front & back), then print or export.
          </p>
        </div>
        <Badge className="w-fit shrink-0 border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
          Front + Back included
        </Badge>
      </div>

      <div className="mb-6 inline-flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {tabBtn('class', 'By Class', <GraduationCap className="h-4 w-4" />)}
        {tabBtn('staff', 'All Staff', <Building2 className="h-4 w-4" />)}
        {tabBtn('custom', 'Custom Selection', <Search className="h-4 w-4" />)}
      </div>

      {mode === 'class' && (
        <Card className="mb-6 overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-700">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/30">
            <CardTitle className="text-base font-semibold">Select class</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="max-w-md space-y-2">
              <Label>Class</Label>
              <Select value={classId} onValueChange={setClassId}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Choose a class…" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {classes.map((c) => {
                    const count = students.filter(
                      (s) =>
                        String(s.classAssignedId) === c.id &&
                        (!s.enrollmentStatus || s.enrollmentStatus === 'active')
                    ).length;
                    return (
                      <SelectItem key={c.id} value={c.id} className="rounded-lg py-2.5">
                        <span className="flex w-full items-center justify-between gap-4">
                          <span>{c.className}</span>
                          <Badge variant="secondary" className="text-[10px] tabular-nums">
                            {count} students
                          </Badge>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'class' && classId && (
        <>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Card previews</h2>
            <span className="text-sm text-slate-500">{classTargets.length} students</span>
          </div>
          {renderPreviewGrid(classTargets, 'No students in this class')}
          {actionPanel}
        </>
      )}

      {mode === 'staff' && (
        <>
          <Card className="mb-6 overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-700">
            <CardContent className="p-6">
              <div className="max-w-md space-y-2">
                <Label>Department</Label>
                <Select value={department || '__all__'} onValueChange={(v) => setDepartment(v === '__all__' ? '' : v)}>
                  <SelectTrigger className="h-12 rounded-xl">
                    <SelectValue placeholder="All departments" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="__all__">All departments</SelectItem>
                    {departments.filter(Boolean).map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {loadingStaff ? (
            <div className="py-16 text-center text-slate-500">
              <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin" />
              Loading staff…
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Staff card previews</h2>
                <span className="text-sm text-slate-500">{staffTargets.length} staff</span>
              </div>
              {renderPreviewGrid(staffTargets, 'No staff found')}
              {actionPanel}
            </>
          )}
        </>
      )}

      {mode === 'custom' && (
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-2xl border-slate-200 shadow-sm dark:border-slate-700">
            <CardContent className="p-6">
              <Label htmlFor="bulk-custom-search" className="mb-2 block">
                Search students or staff
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="bulk-custom-search"
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="Name or ID number…"
                  className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none ring-indigo-200 focus:ring-2 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              {searchingCustom && (
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </p>
              )}

              {customResults.length > 0 && (
                <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                  {customResults.map((row) => {
                    const photo = resolveLogoUrl(row.photoUrl);
                    return (
                      <button
                        key={`${row.entityType}-${row.id}`}
                        type="button"
                        onClick={() => addCustom(row)}
                        className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-indigo-50/60 dark:border-slate-800 dark:hover:bg-indigo-950/20"
                      >
                        {photo ? (
                          <img src={photo} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-white shadow" />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-600">
                            {row.fullName.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white">{row.fullName}</p>
                          <p className="text-xs text-slate-500">
                            {row.entityType === 'STUDENT' ? 'Student' : 'Staff'} · {row.idNumber}
                            {row.className ? ` · ${row.className}` : row.department ? ` · ${row.department}` : ''}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          Add
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {selectedList.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Selected for printing ({selectedList.length})
                </h2>
                <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => setSelected(new Map())}>
                  Clear all
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {selectedList.map((t) => (
                  <div key={t.key} className="relative">
                    <button
                      type="button"
                      onClick={() => removeCustom(t.key)}
                      className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-500 shadow hover:text-red-600 dark:bg-slate-800"
                      aria-label="Remove"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <BulkCardPreviewTile
                      entityType={t.type}
                      entityId={t.id}
                      staffType={t.staffType}
                      fullName={t.fullName}
                      subtitle={t.subtitle}
                      photoUrl={t.photoUrl}
                      idNumber={t.idNumber}
                    />
                  </div>
                ))}
              </div>
              {actionPanel}
            </>
          ) : (
            <p className="text-center text-sm text-slate-400">Search and add people to preview and print their cards.</p>
          )}
        </div>
      )}

      <Dialog open={progressOpen} onOpenChange={() => undefined}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-md`} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="text-emerald-900 dark:text-emerald-100">Generating cards…</DialogTitle>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all duration-300"
                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-sm text-slate-500">
              {progress.current} / {progress.total}
            </p>
            <p className="font-medium text-slate-900 dark:text-white">{progress.name}</p>
            <p className="text-xs text-slate-400">Capturing front and back for each card…</p>
            <Button variant="ghost" size="sm" className="text-slate-500" onClick={() => { cancelRef.current = true; }}>
              Cancel
            </Button>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BulkPrintIdCards;
