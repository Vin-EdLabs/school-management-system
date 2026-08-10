import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Eye,
  Flag,
  Loader2,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  detailDialogContentWideClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useData } from '@/contexts/DataContext';
import {
  formatComplaintWhen,
  severityBadgeClass,
  statusBadgeClass,
  statusLabel,
  type ComplaintSeverity,
} from '@/services/complaintsService';
import ComplaintStatusTimeline from '@/components/complaints/ComplaintStatusTimeline';
import {
  boardingService,
  type BoardingComplaint,
  type ComplaintSeverity as BoardingSeverity,
} from '@/services/boardingService';
import BoardingStudentSearchPicker from './BoardingStudentSearchPicker';
import type { BoardingEnrollment } from '@/services/boardingService';
import {
  boardingHeroBadgeEmerald,
  boardingHeroEmerald,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';

export const BoardingComplaints: React.FC = () => {
  const { students } = useData();
  const [tab, setTab] = useState<'active' | 'resolved'>('active');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BoardingComplaint[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    pending: 0,
    under_review: 0,
    resolved: 0,
    high_severity: 0,
  });
  const [canResolve, setCanResolve] = useState(false);
  const [canFile, setCanFile] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<BoardingComplaint | null>(null);
  const [busy, setBusy] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);

  const [fileOpen, setFileOpen] = useState(false);
  const [enrollments, setEnrollments] = useState<BoardingEnrollment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<BoardingSeverity>('low');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await boardingService.listComplaints({
        status: tab === 'active' ? 'active' : 'resolved',
        search: search.trim() || undefined,
      });
      setItems(data.items || []);
      setSummary(data.summary);
      setCanResolve(Boolean(data.can_resolve));
      setCanFile(Boolean(data.can_file));
    } catch (e) {
      toast({ title: 'Could not load complaints', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [tab, search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!fileOpen) return;
    void boardingService.listEnrollments().then((enr) => {
      setEnrollments(Array.isArray(enr) ? enr.filter((e) => e.status === 'boarder') : []);
    });
  }, [fileOpen]);

  const openDetail = async (row: BoardingComplaint) => {
    setShowResolveForm(false);
    setResolveNote('');
    setSelected(row);
    try {
      setSelected(await boardingService.getComplaint(row.id));
    } catch {
      /* keep list row */
    }
  };

  const markUnderReview = async () => {
    if (!selected || !canResolve) return;
    setBusy(true);
    try {
      const updated = await boardingService.updateComplaintStatus(selected.id, { status: 'under_review' });
      setSelected(updated);
      toast({ title: 'Marked under review' });
      await load();
    } catch (e) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const resolveComplaint = async () => {
    if (!selected || !canResolve) return;
    if (resolveNote.trim().length < 20) {
      toast({ title: 'Resolution note required (min 20 characters)', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const updated = await boardingService.updateComplaintStatus(selected.id, {
        status: 'resolved',
        note: resolveNote.trim(),
      });
      setSelected(updated);
      setShowResolveForm(false);
      toast({ title: 'Complaint resolved' });
      await load();
    } catch (e) {
      toast({ title: 'Resolve failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const submitFile = async () => {
    if (!studentId || !title.trim() || !description.trim()) {
      toast({ title: 'Complete all fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await boardingService.createComplaint({
        student_id: parseInt(studentId, 10),
        title: title.trim(),
        description: description.trim(),
        severity,
      });
      toast({ title: 'Complaint submitted', description: 'Admin or headmaster will review and resolve.' });
      setFileOpen(false);
      setStudentId('');
      setTitle('');
      setDescription('');
      await load();
    } catch (e) {
      toast({ title: 'Submission failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const boarderOptions = enrollments.map((e) => {
    const s = (students || []).find((st) => Number(st.id) === e.student_id);
    return {
      id: String(e.student_id),
      firstName: s?.firstName || e.first_name || '',
      lastName: s?.lastName || e.last_name || '',
      studentId: s?.studentId || e.student_code || '',
      classAssigned: s?.classAssigned || e.class_name,
      gender: s?.gender || e.gender,
    };
  });

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroEmerald}>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className={boardingHeroBadgeEmerald}>
              <Flag className="h-3.5 w-3.5" />
              Boarding oversight
            </div>
            <h1 className={boardingHeroTitle}>Boarding Complaints</h1>
            <p className={boardingHeroSubtitle}>
              {canResolve
                ? 'Review and resolve complaints filed by matron or house master — same flow as school complaints.'
                : 'File concerns about boarders. Admin and headmaster receive and resolve them.'}
            </p>
          </div>
          {canFile ? (
            <Button variant="primaryAction" className="rounded-xl shrink-0" onClick={() => setFileOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              File complaint
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: summary.total },
          { label: 'Pending', value: summary.pending },
          { label: 'Under Review', value: summary.under_review },
          { label: 'Resolved', value: summary.resolved },
          { label: 'High Severity', value: summary.high_severity, tone: 'border-destructive/40 bg-destructive/5 dark:bg-destructive/10' },
        ].map((c) => (
          <Card key={c.label} className={cn(boardingKpiCard, c.tone)}>
            <CardContent className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold tabular-nums mt-1 text-foreground">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl bg-muted/80 p-1">
        {(['active', 'resolved'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors capitalize',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-9 rounded-xl" />
          </div>
          <Button variant="outline" className="rounded-xl" onClick={() => void load()}>
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-2xl shadow-sm overflow-hidden">
        <CardHeader className="border-b bg-muted/30 pb-3">
          <CardTitle className="text-base">{tab === 'active' ? 'Active complaints' : 'Resolved complaints'}</CardTitle>
          <CardDescription>High severity rows show a red accent.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-10 flex justify-center text-muted-foreground gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground text-sm">No complaints in this view.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Filed by</th>
                  <th className="px-4 py-3 font-medium">Boarder</th>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Severity</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={cn('border-t border-border/80', row.severity === 'high' && 'border-l-4 border-l-red-500 bg-red-50/30')}
                  >
                    <td className="px-4 py-3 whitespace-nowrap">{formatComplaintWhen(row.created_at)}</td>
                    <td className="px-4 py-3 font-medium">{row.filed_by_name || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.first_name} {row.last_name}</p>
                      <p className="text-xs text-muted-foreground">{row.class_name || '—'}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{row.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={cn('capitalize', severityBadgeClass(row.severity as ComplaintSeverity))}>
                        {row.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className={statusBadgeClass(row.status as 'pending' | 'under_review' | 'resolved')}>
                        {statusLabel(row.status as 'pending' | 'under_review' | 'resolved')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="outline" className="rounded-lg h-8" onClick={() => void openDetail(row)}>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.title}</SheetTitle>
                <SheetDescription>
                  {selected.first_name} {selected.last_name} · Filed by {selected.filed_by_name || '—'}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <ComplaintStatusTimeline current={selected.status as 'pending' | 'under_review' | 'resolved'} />
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
                </div>
                {selected.resolution_note ? (
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
                    <p className="text-xs font-semibold text-emerald-800 mb-1">Resolution</p>
                    <p className="text-sm">{selected.resolution_note}</p>
                  </div>
                ) : null}
                {canResolve && selected.status !== 'resolved' ? (
                  <div className="space-y-3 pt-2 border-t">
                    {selected.status === 'pending' ? (
                      <Button className="w-full rounded-xl" variant="outline" disabled={busy} onClick={() => void markUnderReview()}>
                        Mark under review
                      </Button>
                    ) : null}
                    {!showResolveForm ? (
                      <Button className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={() => setShowResolveForm(true)}>
                        Resolve complaint
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <Label>Resolution note</Label>
                        <Textarea value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} className="rounded-xl min-h-[100px]" placeholder="Min 20 characters…" />
                        <div className="flex gap-2">
                          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowResolveForm(false)}>Cancel</Button>
                          <Button className="flex-1 rounded-xl" disabled={busy} onClick={() => void resolveComplaint()}>Confirm resolve</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={fileOpen} onOpenChange={setFileOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              File boarding complaint
            </DialogTitle>
          </DialogHeader>
          <DialogBody className={detailDialogBodyClass}>
            <BoardingStudentSearchPicker students={boarderOptions} value={studentId} onChange={setStudentId} />
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label>Severity</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as BoardingSeverity)}>
                <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 rounded-xl min-h-[120px]" />
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button variant="outline" className="rounded-xl" onClick={() => setFileOpen(false)}>Cancel</Button>
            <Button variant="primaryAction" className="rounded-xl" disabled={saving} onClick={() => void submitFile()}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoardingComplaints;
