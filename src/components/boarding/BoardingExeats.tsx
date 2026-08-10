import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DoorOpen,
  Plus,
  RefreshCw,
  Check,
  X,
  LogOut,
  LogIn,
  Calendar,
  MapPin,
  AlertTriangle,
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
import { formatDisplayDate } from '@/utils/dateFormat';
import {
  boardingHeroBadgeEmerald,
  boardingHeroEmerald,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';
import { useData } from '@/contexts/DataContext';
import {
  boardingService,
  type BoardingExeat,
  type ExeatStatus,
  type ExeatType,
} from '@/services/boardingService';

interface BoardingExeatsProps {
  onNavigate?: (module: string) => void;
}

const STATUS_TABS: { value: ExeatStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'signed_out', label: 'Signed out' },
  { value: 'returned', label: 'Returned' },
  { value: 'rejected', label: 'Rejected' },
];

function statusBadgeClass(status: ExeatStatus) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200 border-0';
    case 'approved':
      return 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200 border-0';
    case 'signed_out':
      return 'bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200 border-0';
    case 'returned':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 border-0';
    case 'rejected':
      return 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200 border-0';
    default:
      return 'bg-muted text-muted-foreground border-0';
  }
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ');
}

const EXEAT_TAB_LIST =
  'grid h-auto w-full gap-1 overflow-x-auto p-1.5 dark:h-10 dark:p-1';

function ExeatRecordRow({
  row,
  actionId,
  onAction,
  overdue = false,
}: {
  row: BoardingExeat;
  actionId: number | null;
  onAction: (id: number, action: 'approve' | 'reject' | 'signout' | 'return') => void;
  overdue?: boolean;
}) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-base text-foreground">
              {row.first_name} {row.last_name}
            </p>
            <Badge className={overdue ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200 border-0' : statusBadgeClass(row.status)}>
              {overdue ? 'Overdue' : statusLabel(row.status)}
            </Badge>
            {!overdue ? (
              <Badge variant="outline" className="capitalize text-[10px]">
                {(row.type || 'exeat').replace('_', ' ')}
              </Badge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {[row.class_name || 'No class', row.dorm_name].filter(Boolean).join(' · ')}
          </p>

          <div className="grid grid-cols-1 gap-2.5 rounded-xl border border-border/80 bg-muted/25 p-3 sm:grid-cols-2 dark:bg-muted/15">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Travel dates</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                {formatDisplayDate(row.departure_date, '—')} → {formatDisplayDate(row.return_date, '—')}
              </p>
            </div>
            {row.destination ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Destination</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-sky-600 dark:text-sky-400" />
                  <span className="break-words">{row.destination}</span>
                </p>
              </div>
            ) : null}
            {row.guardian_name ? (
              <div className={row.destination ? 'sm:col-span-2' : ''}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Guardian / pickup</p>
                <p className="mt-1 text-sm font-medium text-foreground">{row.guardian_name}</p>
              </div>
            ) : null}
          </div>

          {row.notes ? (
            <div className="rounded-xl border border-border/80 bg-background px-3.5 py-3 dark:bg-card/80">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Message / notes</p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">{row.notes}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-1.5 shrink-0 sm:flex-col sm:items-stretch">
          {row.status === 'pending' ? (
            <>
              <Button type="button" size="sm" className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700" disabled={actionId === row.id} onClick={() => void onAction(row.id, 'approve')}>
                <Check className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-red-600 dark:text-red-400" disabled={actionId === row.id} onClick={() => void onAction(row.id, 'reject')}>
                <X className="h-3.5 w-3.5 mr-1" />
                Reject
              </Button>
            </>
          ) : null}
          {row.status === 'approved' ? (
            <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg" disabled={actionId === row.id} onClick={() => void onAction(row.id, 'signout')}>
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign out
            </Button>
          ) : null}
          {(row.status === 'signed_out' || (overdue && row.status === 'overdue')) ? (
            <Button type="button" size="sm" className="h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700" disabled={actionId === row.id} onClick={() => void onAction(row.id, 'return')}>
              <LogIn className="h-3.5 w-3.5 mr-1" />
              Mark returned
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ExeatCategory = 'exeat' | 'weekend' | 'overdue';

const TYPE_TABS: { value: ExeatCategory; label: string }[] = [
  { value: 'exeat', label: 'Official exeat' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'overdue', label: 'Overdue' },
];

export const BoardingExeats: React.FC<BoardingExeatsProps> = () => {
  const { students } = useData();
  const [exeats, setExeats] = useState<BoardingExeat[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeCategory, setTypeCategory] = useState<ExeatCategory>('exeat');
  const [activeTab, setActiveTab] = useState<ExeatStatus | 'all'>('pending');
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [formStudentId, setFormStudentId] = useState('');
  const [formType, setFormType] = useState<ExeatType>('exeat');
  const [formGuardian, setFormGuardian] = useState('');
  const [formDestination, setFormDestination] = useState('');
  const [formDeparture, setFormDeparture] = useState('');
  const [formReturn, setFormReturn] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const rows =
        typeCategory === 'overdue'
          ? await boardingService.listOverdueExeats()
          : await boardingService.listExeats();
      setExeats(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast({ title: 'Failed to load exeats', description: (e as Error).message, variant: 'destructive' });
      setExeats([]);
    } finally {
      setLoading(false);
    }
  }, [typeCategory]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (typeCategory === 'overdue') setActiveTab('all');
  }, [typeCategory]);

  const boarderStudents = useMemo(
    () => (students || []).filter((s) => (s.enrollmentStatus || 'active').toLowerCase() === 'active'),
    [students]
  );

  const categoryFiltered = useMemo(() => {
    if (typeCategory === 'overdue') return exeats;
    return exeats.filter((e) => (e.type || 'exeat') === typeCategory);
  }, [exeats, typeCategory]);

  const filtered = useMemo(() => {
    if (activeTab === 'all') return categoryFiltered;
    return categoryFiltered.filter((e) => e.status === activeTab);
  }, [categoryFiltered, activeTab]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: categoryFiltered.length };
    for (const t of STATUS_TABS) {
      if (t.value !== 'all') map[t.value] = categoryFiltered.filter((e) => e.status === t.value).length;
    }
    return map;
  }, [categoryFiltered]);

  const typeCounts = useMemo(() => ({
    exeat: exeats.filter((e) => (e.type || 'exeat') === 'exeat').length,
    weekend: exeats.filter((e) => (e.type || 'exeat') === 'weekend').length,
    overdue: exeats.filter((e) => e.status === 'overdue').length,
  }), [exeats]);

  const openCreate = () => {
    setFormStudentId('');
    setFormType(typeCategory === 'weekend' ? 'weekend' : 'exeat');
    setFormGuardian('');
    setFormDestination('');
    setFormDeparture('');
    setFormReturn('');
    setFormNotes('');
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const studentId = parseInt(formStudentId, 10);
    if (!studentId) {
      toast({ title: 'Select a student', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await boardingService.createExeat({
        student_id: studentId,
        type: formType,
        guardian_name: formGuardian || undefined,
        destination: formDestination || undefined,
        departure_date: formDeparture || undefined,
        return_date: formReturn || undefined,
        notes: formNotes || undefined,
      });
      toast({ title: 'Exeat request created' });
      setCreateOpen(false);
      await loadData();
    } catch (e) {
      toast({ title: 'Create failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: number, action: 'approve' | 'reject' | 'signout' | 'return') => {
    setActionId(id);
    try {
      if (action === 'approve') await boardingService.approveExeat(id);
      else if (action === 'reject') await boardingService.rejectExeat(id);
      else if (action === 'signout') await boardingService.signOutExeat(id);
      else await boardingService.returnExeat(id);
      toast({ title: 'Exeat updated' });
      await loadData();
    } catch (e) {
      toast({ title: 'Action failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroEmerald}>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={boardingHeroBadgeEmerald}>
              <DoorOpen className="h-3.5 w-3.5" />
              Leave management
            </div>
            <h1 className={boardingHeroTitle}>Exeats & Weekends</h1>
            <p className={boardingHeroSubtitle}>
              Track official exeats, weekend passes, sign-outs, returns, and overdue boarders in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-xl" onClick={() => void loadData()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button type="button" variant="primaryAction" size="sm" className="rounded-xl" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              New exeat
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Official exeats', value: typeCounts.exeat },
          { label: 'Weekend passes', value: typeCounts.weekend },
          { label: 'Overdue returns', value: typeCounts.overdue },
        ].map((card) => (
          <Card key={card.label} className={boardingKpiCard}>
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
              <p className="text-3xl font-bold tabular-nums mt-1 text-foreground">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-4 space-y-4">
          <Tabs value={typeCategory} onValueChange={(v) => setTypeCategory(v as ExeatCategory)}>
            <TabsList className={cn(EXEAT_TAB_LIST, 'grid-cols-3')}>
              {TYPE_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                  {tab.label}
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                    {tab.value === 'overdue' ? typeCounts.overdue : typeCounts[tab.value] ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {typeCategory !== 'overdue' ? (
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ExeatStatus | 'all')} className="space-y-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <TabsList className={cn(EXEAT_TAB_LIST, 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6')}>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="flex items-center justify-center gap-1.5 text-xs sm:text-sm">
                  {tab.label}
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] tabular-nums">
                    {counts[tab.value] ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </CardContent>
        </Card>

        {STATUS_TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value} className="mt-0">
            <Card className="rounded-2xl shadow-sm overflow-hidden">
              <CardHeader className="pb-2 border-b bg-muted/30">
                <CardTitle className="text-base flex items-center gap-2">
                  <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  {tab.label} exeats
                </CardTitle>
                <CardDescription>{filtered.length} record(s)</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading && exeats.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
                ) : filtered.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground">
                    <DoorOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No exeats in this category</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filtered.map((row) => (
                      <ExeatRecordRow key={row.id} row={row} actionId={actionId} onAction={runAction} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      ) : (
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/30">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
              Overdue returns
            </CardTitle>
            <CardDescription>{filtered.length} student(s) past expected return date</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && exeats.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <DoorOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No overdue exeats</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((row) => (
                  <ExeatRecordRow key={row.id} row={row} actionId={actionId} onAction={runAction} overdue />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={detailDialogContentWideClass}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle>New exeat request</DialogTitle>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div>
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as ExeatType)}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exeat">Official exeat</SelectItem>
                  <SelectItem value="weekend">Weekend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Student</Label>
              <Select value={formStudentId} onValueChange={setFormStudentId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {boarderStudents.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.firstName} {s.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="guardian">Guardian / pickup person</Label>
              <Input id="guardian" value={formGuardian} onChange={(e) => setFormGuardian(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div>
              <Label htmlFor="destination">Destination</Label>
              <Input id="destination" value={formDestination} onChange={(e) => setFormDestination(e.target.value)} className="mt-1 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="departure">Departure</Label>
                <Input id="departure" type="date" value={formDeparture} onChange={(e) => setFormDeparture(e.target.value)} className="mt-1 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="return">Expected return</Label>
                <Input id="return" type="date" value={formReturn} onChange={(e) => setFormReturn(e.target.value)} className="mt-1 rounded-xl" />
              </div>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="mt-1 rounded-xl" rows={3} />
            </div>
          </DialogBody>
          <DialogFooter className={detailDialogFooterClass}>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="button" onClick={() => void submitCreate()} disabled={saving}>
              {saving ? 'Saving…' : 'Submit request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BoardingExeats;
