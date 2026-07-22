import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Plus, Printer, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  detailDialogBodyClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
  dialogLabelClass,
  dialogSectionClass,
  dialogTitleClass,
  formDialogContentClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import {
  addTimetableColumn,
  deleteClassSlot,
  deletePeriod,
  fetchClassTeachingAssignments,
  fetchClassTimetable,
  fetchLedgerTerms,
  saveClassSlot,
  updateClassSlot,
  updatePeriod,
  type ClassSlot,
  type ClassTeachingAssignment,
  type ClassTimetableGrid,
  type LedgerTerm,
  type Period,
  type TimetableDay,
} from '@/services/timetableApi';
import TimetableGrid from './TimetableGrid';
import TimetableFormSelect from './TimetableFormSelect';
import { buildTimetablePrintDocument } from './timetablePrint';
import { classDisplayName, formatTimeRangeCompact, timetableCardClass, timetableEmptyStateClass, timetableMutedPanelClass, timetableNativeSelectClass, toInputTime } from './timetableUtils';

export default function ClassTimetableBuilder({
  canEdit,
  readOnly = false,
  fixedClassId,
  showPrint = true,
}: {
  canEdit: boolean;
  readOnly?: boolean;
  fixedClassId?: number;
  showPrint?: boolean;
}) {
  const { classes } = useData();
  const { school } = useSchool();
  const { activeLedgerTermId, currentTerm, currentYear } = useActiveTerm();
  const [terms, setTerms] = useState<LedgerTerm[]>([]);
  const [classId, setClassId] = useState(String(fixedClassId || ''));
  const [termId, setTermId] = useState('');
  const [editMode, setEditMode] = useState(() => canEdit && !readOnly);
  const [loading, setLoading] = useState(false);
  const [grid, setGrid] = useState<ClassTimetableGrid | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [periodModalOpen, setPeriodModalOpen] = useState(false);
  const [activeCell, setActiveCell] = useState<{ day: TimetableDay; period: Period; slot: ClassSlot | null } | null>(null);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [periodDraft, setPeriodDraft] = useState({ name: '', start_time: '07:00', end_time: '07:45', is_break: false });
  const [subjectId, setSubjectId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classAssignments, setClassAssignments] = useState<ClassTeachingAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [deletePeriodOpen, setDeletePeriodOpen] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);

  useEffect(() => {
    void fetchLedgerTerms().then(setTerms);
  }, []);

  useEffect(() => {
    if (fixedClassId) setClassId(String(fixedClassId));
  }, [fixedClassId]);

  useEffect(() => {
    if (activeLedgerTermId && !termId) setTermId(String(activeLedgerTermId));
  }, [activeLedgerTermId, termId]);

  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === classId),
    [classes, classId]
  );
  const selectedTerm = useMemo(
    () => terms.find((t) => String(t.id) === termId),
    [terms, termId]
  );

  const loadGrid = useCallback(async () => {
    const cid = parseInt(classId, 10);
    const tid = parseInt(termId, 10);
    if (!Number.isInteger(cid) || !Number.isInteger(tid)) {
      setGrid(null);
      return;
    }
    setLoading(true);
    try {
      setGrid(await fetchClassTimetable(cid, tid));
    } catch (e: unknown) {
      toast({ title: 'Could not load timetable', description: (e as Error).message, variant: 'destructive' });
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }, [classId, termId]);

  useEffect(() => { void loadGrid(); }, [loadGrid]);

  useEffect(() => {
    const cid = parseInt(classId, 10);
    if (!Number.isInteger(cid)) {
      setClassAssignments([]);
      return;
    }
    setAssignmentsLoading(true);
    void fetchClassTeachingAssignments(cid)
      .then(setClassAssignments)
      .catch(() => setClassAssignments([]))
      .finally(() => setAssignmentsLoading(false));
  }, [classId]);

  const classSubjects = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of classAssignments) map.set(row.subject_id, row.subject_name);
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ id, name }));
  }, [classAssignments]);

  const subjectTeachers = useMemo(() => {
    const sid = parseInt(subjectId, 10);
    if (!Number.isInteger(sid)) return [];
    const map = new Map<number, string>();
    for (const row of classAssignments) {
      if (row.subject_id === sid) map.set(row.teacher_id, row.teacher_name);
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, full_name]) => ({ id, full_name }));
  }, [classAssignments, subjectId]);

  const openPeriodEditor = (period: Period) => {
    if (!canEdit || readOnly || !editMode) return;
    setEditingPeriod(period);
    setPeriodDraft({
      name: period.name || '',
      start_time: toInputTime(period.start_time) || '07:00',
      end_time: toInputTime(period.end_time) || '07:45',
      is_break: Boolean(period.is_break),
    });
    setPeriodModalOpen(true);
  };

  const handleSavePeriod = async () => {
    if (!editingPeriod) return;
    setSaving(true);
    try {
      await updatePeriod(editingPeriod.id, {
        name: periodDraft.name.trim() || `Period ${editingPeriod.order_index + 1}`,
        start_time: periodDraft.start_time,
        end_time: periodDraft.end_time,
        is_break: periodDraft.is_break,
      });
      setPeriodModalOpen(false);
      setEditingPeriod(null);
      await loadGrid();
      toast({ title: 'Time slot updated' });
    } catch (e: unknown) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeletePeriod = async () => {
    if (!editingPeriod || !grid) return;
    if (grid.periods.length <= 1) {
      toast({ title: 'Keep at least one column', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await deletePeriod(editingPeriod.id);
      setDeletePeriodOpen(false);
      setPeriodModalOpen(false);
      setEditingPeriod(null);
      await loadGrid();
      toast({ title: 'Column deleted' });
    } catch (e: unknown) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddColumn = async () => {
    if (!canEdit || readOnly) return;
    const cid = parseInt(classId, 10);
    const tid = parseInt(termId, 10);
    if (!Number.isInteger(cid) || !Number.isInteger(tid)) return;
    setAddingColumn(true);
    try {
      await addTimetableColumn(cid, tid);
      await loadGrid();
      toast({ title: 'Column added' });
    } catch (e: unknown) {
      toast({ title: 'Could not add column', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setAddingColumn(false);
    }
  };

  const openCell = (day: TimetableDay, period: Period, slot: ClassSlot | null) => {
    if (!canEdit || readOnly || !editMode || period.is_break) return;
    setActiveCell({ day, period, slot });
    setSubjectId(slot ? String(slot.subject_id) : '');
    setTeacherId(slot?.teacher_id ? String(slot.teacher_id) : '');
    setConflict(null);
    setModalOpen(true);
  };

  const handleSave = async (force = false) => {
    const cid = parseInt(classId, 10);
    const tid = parseInt(termId, 10);
    const sid = parseInt(subjectId, 10);
    const tidTeacher = teacherId ? parseInt(teacherId, 10) : null;
    if (!activeCell || !Number.isInteger(cid) || !Number.isInteger(tid) || !Number.isInteger(sid) || !tidTeacher) return;

    setSaving(true);
    setConflict(null);
    try {
      if (activeCell.slot) {
        await updateClassSlot(activeCell.slot.id, {
          subject_id: sid,
          teacher_id: tidTeacher,
          force,
        });
      } else {
        await saveClassSlot({
          class_id: cid,
          term_id: tid,
          day_of_week: activeCell.day,
          period_id: activeCell.period.id,
          subject_id: sid,
          teacher_id: tidTeacher,
          force,
        });
      }
      setModalOpen(false);
      await loadGrid();
      toast({ title: 'Timetable updated' });
    } catch (e: unknown) {
      const err = e as Error & { status?: number; data?: { error?: string; code?: string } };
      const msg = err.data?.error || err.message;
      if (err.status === 409 || err.data?.code === 'TEACHER_CONFLICT') {
        setConflict(msg);
      } else {
        toast({ title: 'Save failed', description: msg, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async () => {
    if (!activeCell?.slot) return;
    setSaving(true);
    try {
      await deleteClassSlot(activeCell.slot.id);
      setModalOpen(false);
      await loadGrid();
      toast({ title: 'Slot removed' });
    } catch (e: unknown) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!grid) return;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(
      buildTimetablePrintDocument({
        grid,
        schoolName: school?.name || 'School',
        schoolLogoUrl: school?.logo_url || null,
        className: selectedClass ? classDisplayName(selectedClass) : 'Class',
        termLabel: selectedTerm?.name || currentTerm || 'Term',
        yearLabel: currentYear || undefined,
      })
    );
    w.document.close();
  };

  const effectiveEdit = canEdit && !readOnly && editMode;
  const columnCount = grid?.periods.length ?? 0;

  return (
    <div className="space-y-6">
      <div className={`${timetableCardClass} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {!fixedClassId ? (
              <div>
                <label className={dialogLabelClass}>Class</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className={`mt-1.5 ${timetableNativeSelectClass}`}>
                  <option value="">Select class</option>
                  {classes.map((c) => <option key={c.id} value={c.id}>{classDisplayName(c)}</option>)}
                </select>
              </div>
            ) : null}
            <div>
              <label className={dialogLabelClass}>Term</label>
              <select value={termId} onChange={(e) => setTermId(e.target.value)} className={`mt-1.5 ${timetableNativeSelectClass}`}>
                <option value="">Select term</option>
                {terms.map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_current ? ' (current)' : ''}</option>)}
              </select>
            </div>
            {canEdit && !readOnly ? (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <Pencil className="h-4 w-4 text-emerald-600 shrink-0 dark:text-emerald-400" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Edit mode</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Click cells to fill · headers to edit columns</p>
                </div>
                <Switch checked={editMode} onCheckedChange={setEditMode} />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {effectiveEdit ? (
              <Button
                variant="outline"
                className="rounded-xl border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                onClick={() => void handleAddColumn()}
                disabled={addingColumn || !classId || !termId}
              >
                {addingColumn ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Add column
              </Button>
            ) : null}
            {showPrint && grid ? (
              <Button variant="outline" className="rounded-xl" onClick={handlePrint} disabled={!classId || !termId}>
                <Printer className="mr-2 h-4 w-4" /> Print
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {loading ? (
        <div className={`flex items-center justify-center py-20 text-slate-500 dark:text-slate-400 ${timetableCardClass}`}>
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading timetable…
        </div>
      ) : !classId || !termId ? (
        <div className={`${timetableEmptyStateClass} p-12 shadow-sm`}>
          <CalendarDays className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-300">Select a class and term</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Each class has its own columns and break times — add as many time slots as you need.</p>
        </div>
      ) : grid ? (
        <div className={`overflow-hidden ${timetableCardClass}`}>
          <div className={`flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${timetableMutedPanelClass} border-0 rounded-none`}>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {selectedClass ? classDisplayName(selectedClass) : 'Class'} timetable
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedTerm?.name || currentTerm}{currentYear ? ` · ${currentYear}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-lg">{columnCount} columns</Badge>
              <Badge variant="outline" className="rounded-lg">Mon – Fri</Badge>
            </div>
          </div>
          {canEdit && !readOnly && !editMode ? (
            <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              Turn on <strong>Edit mode</strong> to fill cells or manage columns.
            </div>
          ) : null}
          <div className="p-3 sm:p-4">
            <TimetableGrid
              grid={grid}
              editMode={effectiveEdit}
              embedded
              onCellClick={openCell}
              onPeriodClick={canEdit && !readOnly ? openPeriodEditor : undefined}
              onAddColumn={canEdit && !readOnly && effectiveEdit ? () => void handleAddColumn() : undefined}
              addingColumn={addingColumn}
            />
          </div>
        </div>
      ) : null}

      <Dialog open={periodModalOpen} onOpenChange={setPeriodModalOpen}>
        <DialogContent className={formDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>Edit time column</DialogTitle>
            <DialogDescription>
              {editingPeriod
                ? `${formatTimeRangeCompact(editingPeriod.start_time, editingPeriod.end_time)} · click save or delete this column`
                : 'Update column name, times, or break status.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className={dialogSectionClass}>
              <div>
                <label className={dialogLabelClass}>Column name</label>
                <Input
                  className="mt-1.5"
                  value={periodDraft.name}
                  onChange={(e) => setPeriodDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Period 1, Break, Assembly"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={dialogLabelClass}>Start time</label>
                  <Input className="mt-1.5" type="time" value={periodDraft.start_time} onChange={(e) => setPeriodDraft((d) => ({ ...d, start_time: e.target.value }))} />
                </div>
                <div>
                  <label className={dialogLabelClass}>End time</label>
                  <Input className="mt-1.5" type="time" value={periodDraft.end_time} onChange={(e) => setPeriodDraft((d) => ({ ...d, end_time: e.target.value }))} />
                </div>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-white/80 px-3 py-2.5 text-sm font-medium text-slate-700 dark:border-emerald-900/40 dark:bg-slate-900/60 dark:text-slate-200">
                <Switch
                  checked={periodDraft.is_break}
                  onCheckedChange={(checked) => setPeriodDraft((d) => ({ ...d, is_break: checked }))}
                />
                Mark as break (no lessons in this column)
              </label>
            </div>
          </DialogBody>
          <DialogFooter className={`${detailDialogFooterClass} flex-col-reverse gap-2 sm:flex-row sm:justify-between`}>
            <Button
              variant="destructive"
              onClick={() => setDeletePeriodOpen(true)}
              disabled={saving || (grid?.periods.length ?? 0) <= 1}
              className="rounded-xl"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete column
            </Button>
            <div className="flex gap-2 sm:ml-auto">
              <Button variant="outline" className="rounded-xl" onClick={() => setPeriodModalOpen(false)}>Cancel</Button>
              <Button onClick={() => void handleSavePeriod()} disabled={saving} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletePeriodOpen} onOpenChange={setDeletePeriodOpen}>
        <AlertDialogContent className="rounded-[1rem] border-t-4 border-red-500 sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this time column?</AlertDialogTitle>
            <AlertDialogDescription>
              {editingPeriod
                ? `"${editingPeriod.name}" and all lessons in that column will be removed. This cannot be undone.`
                : 'This column and all lessons in it will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={saving}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeletePeriod();
              }}
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete column
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={formDialogContentClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={dialogTitleClass}>
              {activeCell?.slot ? 'Edit lesson' : 'Add lesson'}
            </DialogTitle>
            <DialogDescription>
              {activeCell
                ? `${activeCell.day} · ${activeCell.period.name} (${formatTimeRangeCompact(activeCell.period.start_time, activeCell.period.end_time)})`
                : 'Choose the subject first, then the teacher for this cell.'}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            {conflict ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {conflict}
                <Button size="sm" variant="outline" className="mt-2 rounded-lg" onClick={() => void handleSave(true)} disabled={saving}>
                  Save anyway
                </Button>
              </div>
            ) : null}
            <div className={dialogSectionClass}>
              <div>
                <label className={dialogLabelClass}>
                  Subject
                  {assignmentsLoading ? <span className="ml-2 font-normal normal-case text-slate-400">Loading…</span> : null}
                </label>
                <div className="mt-1.5">
                  <TimetableFormSelect
                    value={subjectId}
                    onValueChange={(value) => {
                      setSubjectId(value);
                      const tid = parseInt(teacherId, 10);
                      const sid = parseInt(value, 10);
                      if (!Number.isInteger(sid) || !Number.isInteger(tid)) {
                        setTeacherId('');
                        return;
                      }
                      const stillValid = classAssignments.some(
                        (row) => row.subject_id === sid && row.teacher_id === tid
                      );
                      if (!stillValid) setTeacherId('');
                    }}
                    placeholder="Select subject for this class"
                    disabled={assignmentsLoading || classSubjects.length === 0}
                    options={classSubjects.map((s) => ({
                      value: String(s.id),
                      label: s.name,
                    }))}
                  />
                </div>
              </div>
              <div>
                <label className={dialogLabelClass}>Teacher</label>
                <div className="mt-1.5">
                  <TimetableFormSelect
                    value={teacherId}
                    onValueChange={setTeacherId}
                    placeholder={subjectId ? 'Select teacher for this subject' : 'Select a subject first'}
                    disabled={!subjectId || subjectTeachers.length === 0}
                    options={subjectTeachers.map((t) => ({
                      value: String(t.id),
                      label: t.full_name,
                    }))}
                  />
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className={`${detailDialogFooterClass} gap-2`}>
            {activeCell?.slot ? (
              <Button variant="destructive" className="rounded-xl mr-auto" onClick={() => void handleDeleteSlot()} disabled={saving}>
                <Trash2 className="mr-2 h-4 w-4" /> Remove
              </Button>
            ) : null}
            <Button variant="outline" className="rounded-xl" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave(false)} disabled={saving || !subjectId || !teacherId} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
