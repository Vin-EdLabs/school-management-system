import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Stethoscope,
  Plus,
  RefreshCw,
  Pencil,
  HeartPulse,
  Home,
  Activity,
  Thermometer,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { formatDateForInput, formatDisplayDate } from '@/utils/dateFormat';
import {
  boardingHeroBadgeHealth,
  boardingHeroHealth,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';
import {
  boardingService,
  type BoardingEnrollment,
  type BoardingSickBayRecord,
  type SickBayStatus,
} from '@/services/boardingService';

const STATUS_TABS: { value: SickBayStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All cases' },
  { value: 'resting', label: 'Resting' },
  { value: 'sent_home', label: 'Sent home' },
  { value: 'recovered', label: 'Recovered' },
];

function statusBadge(status: SickBayStatus) {
  switch (status) {
    case 'resting':
      return 'bg-amber-100 text-amber-900 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-100 dark:border-amber-800/60';
    case 'sent_home':
      return 'bg-violet-100 text-violet-900 border-violet-200/80 dark:bg-violet-950/50 dark:text-violet-100 dark:border-violet-800/60';
    case 'recovered':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-100 dark:border-emerald-800/60';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function statusLabel(status: SickBayStatus) {
  return status.replace('_', ' ');
}

export const BoardingSickBay: React.FC = () => {
  const [records, setRecords] = useState<BoardingSickBayRecord[]>([]);
  const [boarders, setBoarders] = useState<BoardingEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<SickBayStatus | 'all'>('resting');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BoardingSickBayRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const [formStudentId, setFormStudentId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formSymptoms, setFormSymptoms] = useState('');
  const [formAction, setFormAction] = useState('');
  const [formStatus, setFormStatus] = useState<SickBayStatus>('resting');
  const [formResolved, setFormResolved] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, enrollments] = await Promise.all([
        boardingService.listSickBay(),
        boardingService.listEnrollments(),
      ]);
      setRecords(Array.isArray(rows) ? rows : []);
      setBoarders(Array.isArray(enrollments) ? enrollments.filter((e) => e.status === 'boarder') : []);
    } catch (e) {
      toast({ title: 'Failed to load sick bay', description: (e as Error).message, variant: 'destructive' });
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return records;
    return records.filter((r) => r.status === activeTab);
  }, [records, activeTab]);

  const stats = useMemo(() => ({
    active: records.filter((r) => r.status === 'resting' || r.status === 'sent_home').length,
    resting: records.filter((r) => r.status === 'resting').length,
    sentHome: records.filter((r) => r.status === 'sent_home').length,
    recovered: records.filter((r) => r.status === 'recovered').length,
  }), [records]);

  const openCreate = () => {
    setEditing(null);
    setFormStudentId('');
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormSymptoms('');
    setFormAction('');
    setFormStatus('resting');
    setFormResolved('');
    setDialogOpen(true);
  };

  const openEdit = (row: BoardingSickBayRecord) => {
    setEditing(row);
    setFormStudentId(String(row.student_id));
    setFormDate(formatDateForInput(row.reported_date));
    setFormSymptoms(row.symptoms || '');
    setFormAction(row.action_taken || '');
    setFormStatus(row.status);
    setFormResolved(formatDateForInput(row.resolved_date));
    setDialogOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (editing) {
        await boardingService.updateSickBay(editing.id, {
          symptoms: formSymptoms || undefined,
          action_taken: formAction || undefined,
          status: formStatus,
          resolved_date: formResolved || null,
        });
        toast({ title: 'Record updated' });
      } else {
        const studentId = parseInt(formStudentId, 10);
        if (!studentId) {
          toast({ title: 'Select a boarder', variant: 'destructive' });
          setSaving(false);
          return;
        }
        await boardingService.createSickBay({
          student_id: studentId,
          reported_date: formDate,
          symptoms: formSymptoms || undefined,
          action_taken: formAction || undefined,
          status: formStatus,
        });
        toast({ title: 'Sick bay case logged' });
      }
      setDialogOpen(false);
      await loadData();
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroHealth}>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={boardingHeroBadgeHealth}>
              <HeartPulse className="h-3.5 w-3.5" />
              Health & wellness
            </div>
            <h1 className={boardingHeroTitle}>Sick Bay</h1>
            <p className={boardingHeroSubtitle}>
              Log illnesses, monitor resting boarders, record treatments, and track recovery or send-home decisions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="primaryAction" size="sm" className="rounded-xl" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Log new case
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active cases', value: stats.active, icon: Activity, accent: 'text-teal-600 dark:text-teal-400' },
          { label: 'Resting in sick bay', value: stats.resting, icon: Thermometer, accent: 'text-amber-600 dark:text-amber-400' },
          { label: 'Sent home', value: stats.sentHome, icon: Home, accent: 'text-violet-600 dark:text-violet-400' },
          { label: 'Recovered', value: stats.recovered, icon: HeartPulse, accent: 'text-emerald-600 dark:text-emerald-400' },
        ].map((card) => (
          <Card key={card.label} className={boardingKpiCard}>
            <CardContent className="p-4 flex items-start gap-3">
              <div className={cn('rounded-xl bg-muted p-2', card.accent)}>
                <card.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold tabular-nums mt-0.5 text-foreground">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SickBayStatus | 'all')}>
        <TabsList className="w-full flex flex-wrap h-auto gap-1.5 p-1.5 rounded-2xl bg-muted/50 border border-border">
          {STATUS_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="rounded-xl text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-4">
            {loading && records.length === 0 ? (
              <Card className={boardingKpiCard}>
                <CardContent className="p-12 text-center text-muted-foreground text-sm">Loading health records…</CardContent>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="rounded-2xl border-dashed border-border bg-muted/30">
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Stethoscope className="h-10 w-10 mx-auto mb-3 text-teal-500 dark:text-teal-400" />
                  <p className="text-sm font-medium text-foreground">No cases in this category</p>
                  <p className="text-xs mt-1 text-muted-foreground">Log a new case when a boarder visits the sick bay</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((row) => (
                  <Card key={row.id} className={cn(boardingKpiCard, 'overflow-hidden hover:shadow-md transition-shadow')}>
                    <CardHeader className="pb-3 bg-muted/30 border-b border-border">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-base truncate">
                            {row.first_name} {row.last_name}
                          </CardTitle>
                          <CardDescription className="mt-0.5">
                            {row.class_name || 'No class'}
                            {row.dorm_name ? ` · ${row.dorm_name}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline" className={cn('shrink-0 capitalize', statusBadge(row.status))}>
                          {statusLabel(row.status)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          Reported {formatDisplayDate(row.reported_date)}
                        </span>
                        {row.resolved_date ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5">
                            Resolved {formatDisplayDate(row.resolved_date)}
                          </span>
                        ) : null}
                      </div>
                      {row.symptoms ? (
                        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 dark:bg-amber-950/30 dark:border-amber-800/40">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200/80">Symptoms</p>
                          <p className="text-sm text-foreground mt-0.5">{row.symptoms}</p>
                        </div>
                      ) : null}
                      {row.action_taken ? (
                        <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-3 py-2 dark:bg-sky-950/30 dark:border-sky-800/40">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-sky-800 dark:text-sky-200/80">Action taken</p>
                          <p className="text-sm text-foreground mt-0.5">{row.action_taken}</p>
                        </div>
                      ) : null}
                      <Button type="button" variant="outline" size="sm" className="w-full rounded-xl" onClick={() => openEdit(row)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Update case
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              {editing ? 'Update health record' : 'Log sick bay case'}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            {!editing ? (
              <div>
                <Label>Boarder</Label>
                <Select value={formStudentId} onValueChange={setFormStudentId}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue placeholder="Select boarder" />
                  </SelectTrigger>
                  <SelectContent>
                    {boarders.map((b) => (
                      <SelectItem key={b.student_id} value={String(b.student_id)}>
                        {b.first_name} {b.last_name}
                        {b.dorm_name ? ` · ${b.dorm_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <div>
              <Label htmlFor="reported">Reported date</Label>
              <Input
                id="reported"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 rounded-xl"
                disabled={!!editing}
              />
            </div>
            <div>
              <Label htmlFor="symptoms">Symptoms / complaint</Label>
              <Textarea id="symptoms" value={formSymptoms} onChange={(e) => setFormSymptoms(e.target.value)} className="mt-1 rounded-xl" rows={3} placeholder="e.g. Fever, headache, stomach pain…" />
            </div>
            <div>
              <Label htmlFor="action">Treatment / action taken</Label>
              <Textarea id="action" value={formAction} onChange={(e) => setFormAction(e.target.value)} className="mt-1 rounded-xl" rows={3} placeholder="e.g. Paracetamol given, parent contacted, resting in sick bay…" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as SickBayStatus)}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resting">Resting in sick bay</SelectItem>
                  <SelectItem value="sent_home">Sent home</SelectItem>
                  <SelectItem value="recovered">Recovered</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editing ? (
              <div>
                <Label htmlFor="resolved">Resolved date</Label>
                <Input id="resolved" type="date" value={formResolved} onChange={(e) => setFormResolved(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            ) : null}
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="button" variant="primaryAction" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoardingSickBay;
