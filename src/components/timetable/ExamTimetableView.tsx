import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogBody,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { useData } from '@/contexts/DataContext';
import { useActiveTerm } from '@/contexts/ActiveTermContext';
import {
  createExam, deleteExam, fetchExams, fetchLedgerTerms, updateExam, type ExamEntry, type LedgerTerm,
} from '@/services/timetableApi';
import { classAccentColor, classDisplayName, formatExamDate, formatTimeRange, timetableNativeSelectClass, toInputTime } from './timetableUtils';

export default function ExamTimetableView({
  canEdit,
  readOnly = false,
  fixedClassId,
  showClassFilter = true,
  groupAllClasses = false,
}: {
  canEdit: boolean;
  readOnly?: boolean;
  fixedClassId?: number;
  showClassFilter?: boolean;
  groupAllClasses?: boolean;
}) {
  const { classes, subjects } = useData();
  const { activeLedgerTermId } = useActiveTerm();
  const [terms, setTerms] = useState<LedgerTerm[]>([]);
  const [classId, setClassId] = useState(fixedClassId ? String(fixedClassId) : '');
  const [termId, setTermId] = useState('');
  const [exams, setExams] = useState<ExamEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExamEntry | null>(null);
  const [form, setForm] = useState({
    class_id: '', subject_id: '', exam_date: '', start_time: '08:00', end_time: '10:00', venue: '', notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { void fetchLedgerTerms().then(setTerms); }, []);
  useEffect(() => { if (activeLedgerTermId && !termId) setTermId(String(activeLedgerTermId)); }, [activeLedgerTermId, termId]);
  useEffect(() => { if (fixedClassId) setClassId(String(fixedClassId)); }, [fixedClassId]);

  const load = useCallback(async () => {
    const tid = parseInt(termId, 10);
    if (!Number.isInteger(tid)) { setExams([]); return; }
    const cid = classId ? parseInt(classId, 10) : undefined;
    if (showClassFilter && !groupAllClasses && !cid) { setExams([]); return; }
    setLoading(true);
    try {
      setExams(await fetchExams(tid, groupAllClasses ? undefined : cid));
    } catch (e: unknown) {
      toast({ title: 'Could not load exams', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [termId, classId, showClassFilter, groupAllClasses]);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ExamEntry[]>();
    for (const exam of exams) {
      const key = exam.exam_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(exam);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [exams]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      class_id: classId || String(classes[0]?.id || ''),
      subject_id: '',
      exam_date: new Date().toISOString().slice(0, 10),
      start_time: '08:00',
      end_time: '10:00',
      venue: '',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (exam: ExamEntry) => {
    setEditing(exam);
    setForm({
      class_id: String(exam.class_id),
      subject_id: String(exam.subject_id),
      exam_date: exam.exam_date,
      start_time: toInputTime(exam.start_time),
      end_time: toInputTime(exam.end_time),
      venue: exam.venue || '',
      notes: exam.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const tid = parseInt(termId, 10);
    setSaving(true);
    try {
      const payload = {
        class_id: parseInt(form.class_id, 10),
        term_id: tid,
        subject_id: parseInt(form.subject_id, 10),
        exam_date: form.exam_date,
        start_time: form.start_time,
        end_time: form.end_time,
        venue: form.venue,
        notes: form.notes,
      };
      if (editing) await updateExam(editing.id, payload);
      else await createExam(payload);
      setModalOpen(false);
      await load();
      toast({ title: editing ? 'Exam updated' : 'Exam added' });
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (exam: ExamEntry) => {
    if (!window.confirm('Delete this exam?')) return;
    try {
      await deleteExam(exam.id);
      await load();
      toast({ title: 'Exam deleted' });
    } catch (e: unknown) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-3 sm:grid-cols-2">
          {showClassFilter && !fixedClassId ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} className={timetableNativeSelectClass}>
                <option value="">{groupAllClasses ? 'All classes' : 'Select class'}</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{classDisplayName(c)}</option>)}
              </select>
            </div>
          ) : null}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Term</label>
            <select value={termId} onChange={(e) => setTermId(e.target.value)} className={timetableNativeSelectClass}>
              <option value="">Select term</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        {canEdit && !readOnly ? (
          <Button onClick={openCreate} disabled={!termId} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="mr-2 h-4 w-4" /> Add exam
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No exams scheduled for this selection.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, rows]) => (
            <section key={date}>
              <h3 className="mb-3 text-sm font-bold text-slate-800">{formatExamDate(date)}</h3>
              <div className="space-y-3">
                {rows.map((exam) => (
                  <div key={exam.id} className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm border-l-4 ${classAccentColor(exam.class_id)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-slate-900">{exam.subject_name}</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-700">{formatTimeRange(exam.start_time, exam.end_time)}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {[exam.venue, exam.class_name].filter(Boolean).join(' · ')}
                        </p>
                        {exam.notes ? <p className="mt-2 text-xs text-slate-600">{exam.notes}</p> : null}
                      </div>
                      {canEdit && !readOnly ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(exam)}><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" className="text-red-600" onClick={() => void handleDelete(exam)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editing ? 'Edit exam' : 'Add exam'}</DialogTitle></DialogHeader>
          <DialogBody className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Class</label>
              <select value={form.class_id} onChange={(e) => setForm((f) => ({ ...f, class_id: e.target.value }))} className={timetableNativeSelectClass}>
                {classes.map((c) => <option key={c.id} value={c.id}>{classDisplayName(c)}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Subject</label>
              <select value={form.subject_id} onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
                <option value="">Select subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Exam date</label>
              <Input type="date" value={form.exam_date} onChange={(e) => setForm((f) => ({ ...f, exam_date: e.target.value }))} />
            </div>
            <div />
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Start time</label>
              <Input type="time" value={form.start_time} onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">End time</label>
              <Input type="time" value={form.end_time} onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Venue (optional)</label>
              <Input value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="Hall A" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-600">Notes (optional)</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving || !form.class_id || !form.subject_id || !form.exam_date} className="bg-emerald-600 hover:bg-emerald-700">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
