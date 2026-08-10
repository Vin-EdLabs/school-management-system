import React, { useCallback, useEffect, useState } from 'react';
import {
  ClipboardList,
  RefreshCw,
  Save,
  UserCheck,
  UserX,
  AlertTriangle,
  Plus,
  Users,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  boardingHeroBadgeEmerald,
  boardingHeroEmerald,
  boardingHeroSubtitle,
  boardingHeroTitle,
  boardingKpiCard,
} from '@/utils/boardingUi';
import {
  boardingService,
  type BoardingDorm,
  type BoardingRollCall as BoardingRollCallSession,
  type BoardingRollCallEntry,
  type RollCallEntryStatus,
} from '@/services/boardingService';

export const BoardingRollCall: React.FC = () => {
  const today = new Date().toISOString().slice(0, 10);
  const [dorms, setDorms] = useState<BoardingDorm[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedDormId, setSelectedDormId] = useState<string>('all');
  const [rollCalls, setRollCalls] = useState<BoardingRollCallSession[]>([]);
  const [activeRollCall, setActiveRollCall] = useState<BoardingRollCallSession | null>(null);
  const [entries, setEntries] = useState<BoardingRollCallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadMeta = useCallback(async () => {
    try {
      const dormList = await boardingService.listDorms();
      setDorms(Array.isArray(dormList) ? dormList : []);
    } catch {
      setDorms([]);
    }
  }, []);

  const loadRollCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params: { date?: string; dorm_id?: number } = { date: selectedDate };
      if (selectedDormId !== 'all') params.dorm_id = parseInt(selectedDormId, 10);
      const list = await boardingService.listRollCalls(params);
      setRollCalls(Array.isArray(list) ? list : []);
    } catch (e) {
      toast({ title: 'Failed to load roll calls', description: (e as Error).message, variant: 'destructive' });
      setRollCalls([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedDormId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    void loadRollCalls();
    setActiveRollCall(null);
    setEntries([]);
  }, [loadRollCalls]);

  const loadEntries = async (rollCall: BoardingRollCallSession) => {
    setActiveRollCall(rollCall);
    setLoadingEntries(true);
    try {
      const rows = await boardingService.getRollCallEntries(rollCall.id);
      setEntries(Array.isArray(rows) ? rows : []);
    } catch (e) {
      toast({ title: 'Failed to load entries', description: (e as Error).message, variant: 'destructive' });
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  const startRollCall = async () => {
    setCreating(true);
    try {
      const created = await boardingService.createRollCall({
        roll_call_date: selectedDate,
        dorm_id: selectedDormId !== 'all' ? parseInt(selectedDormId, 10) : null,
      });
      toast({ title: 'Roll call started', description: 'Boarders loaded — mark attendance and save.' });
      await loadRollCalls();
      await loadEntries(created);
    } catch (e) {
      toast({ title: 'Could not start roll call', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const updateEntry = (studentId: number, patch: Partial<BoardingRollCallEntry>) => {
    setEntries((prev) =>
      prev.map((e) => (e.student_id === studentId ? { ...e, ...patch } : e))
    );
  };

  const markAllPresent = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, status: 'present' as RollCallEntryStatus, flagged: false })));
  };

  const saveEntries = async () => {
    if (!activeRollCall) return;
    if (entries.length === 0) {
      toast({ title: 'No boarders to save', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = entries.map((e) => ({
        student_id: e.student_id,
        status: e.status as RollCallEntryStatus,
        flagged: e.flagged,
        note: e.note || undefined,
      }));
      const saved = await boardingService.saveRollCallEntries(activeRollCall.id, payload);
      setEntries(Array.isArray(saved) ? saved : entries);
      toast({ title: 'Roll call saved' });
      await loadRollCalls();
    } catch (e) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const presentCount = entries.filter((e) => e.status === 'present').length;
  const absentCount = entries.filter((e) => e.status === 'absent').length;
  const flaggedCount = entries.filter((e) => e.flagged).length;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 animate-in fade-in duration-300">
      <div className={boardingHeroEmerald}>
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className={boardingHeroBadgeEmerald}>
              <ClipboardList className="h-3.5 w-3.5" />
              Evening attendance
            </div>
            <h1 className={boardingHeroTitle}>Roll Call</h1>
            <p className={boardingHeroSubtitle}>
              Mark boarders present or absent. Absences without an approved exeat can be flagged for follow-up.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl shrink-0"
            onClick={() => void loadRollCalls()}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {activeRollCall ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Present', value: presentCount },
            { label: 'Absent', value: absentCount },
            { label: 'Flagged', value: flaggedCount },
          ].map((card) => (
            <Card key={card.label} className={boardingKpiCard}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                <p className="text-3xl font-bold tabular-nums mt-1 text-foreground">{card.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className={cn(boardingKpiCard)}>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3 md:items-end">
          <div className="flex-1">
            <Label htmlFor="rc-date">Date</Label>
            <Input id="rc-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="mt-1 rounded-xl" />
          </div>
          <div className="flex-1">
            <Label>Dormitory</Label>
            <Select value={selectedDormId} onValueChange={setSelectedDormId}>
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All dorms</SelectItem>
                {dorms.map((d) => (
                  <SelectItem key={d.id} value={String(d.id)}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="button" variant="primaryAction" className="rounded-xl h-10" onClick={() => void startRollCall()} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            {creating ? 'Starting…' : 'Start roll call'}
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className={cn(boardingKpiCard, 'lg:col-span-1')}>
          <CardHeader className="pb-2 border-b bg-muted/30">
            <CardTitle className="text-base">Sessions</CardTitle>
            <CardDescription>{selectedDate}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading && rollCalls.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">Loading…</p>
            ) : rollCalls.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No roll call for this date</p>
                <p className="text-xs mt-1">Start one above to load boarders</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {rollCalls.map((rc) => (
                  <button
                    key={rc.id}
                    type="button"
                    onClick={() => void loadEntries(rc)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-emerald-50/50 transition-colors',
                      activeRollCall?.id === rc.id && 'bg-emerald-50/90 dark:bg-emerald-950/20'
                    )}
                  >
                    <p className="font-semibold text-sm">{rc.dorm_name || 'All dorms'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {rc.present_count ?? 0} present · {rc.absent_count ?? 0} absent
                      {(rc.entry_count ?? 0) > 0 ? ` · ${rc.entry_count} boarders` : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className={cn(boardingKpiCard, 'lg:col-span-2 overflow-hidden')}>
          <CardHeader className="pb-2 border-b bg-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-emerald-600" />
                  {activeRollCall ? activeRollCall.dorm_name || 'Roll call' : 'Select a session'}
                </CardTitle>
                {activeRollCall ? (
                  <CardDescription className="mt-1">
                    {presentCount} present · {absentCount} absent · {flaggedCount} flagged
                  </CardDescription>
                ) : null}
              </div>
              {activeRollCall && entries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={markAllPresent}>
                    Mark all present
                  </Button>
                  <Button type="button" size="sm" className="rounded-xl bg-emerald-600 hover:bg-emerald-700" onClick={() => void saveEntries()} disabled={saving || loadingEntries}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? 'Saving…' : 'Save roll call'}
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {!activeRollCall ? (
              <p className="p-10 text-center text-muted-foreground text-sm">Choose or start a roll call session</p>
            ) : loadingEntries ? (
              <p className="p-10 text-center text-muted-foreground text-sm">Loading boarders…</p>
            ) : entries.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No boarders enrolled for this dorm</p>
                <p className="text-xs mt-1">Add boarders under Boarders & Day Students first</p>
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[32rem] overflow-y-auto">
                {entries.map((entry) => (
                  <div key={entry.student_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/20">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm">
                        {entry.first_name} {entry.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {entry.class_name || 'No class'}
                        {entry.bed_number ? ` · Bed ${entry.bed_number}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={entry.status === 'present' ? 'default' : 'outline'}
                        className={cn('h-8 rounded-lg', entry.status === 'present' && 'bg-emerald-600 hover:bg-emerald-700')}
                        onClick={() => updateEntry(entry.student_id, { status: 'present', flagged: false })}
                      >
                        <UserCheck className="h-3.5 w-3.5 mr-1" />
                        Present
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={entry.status === 'absent' ? 'default' : 'outline'}
                        className={cn('h-8 rounded-lg', entry.status === 'absent' && 'bg-slate-600 hover:bg-slate-700')}
                        onClick={() => updateEntry(entry.student_id, { status: 'absent' })}
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" />
                        Absent
                      </Button>
                      {entry.status === 'absent' ? (
                        <label className="inline-flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded-lg border border-amber-200">
                          <Switch
                            checked={entry.flagged}
                            onCheckedChange={(v) => updateEntry(entry.student_id, { flagged: v })}
                          />
                          <AlertTriangle className="h-3.5 w-3.5" />
                          Flag (no exeat)
                        </label>
                      ) : null}
                      {entry.flagged ? (
                        <Badge className="bg-amber-100 text-amber-800 border-0">Flagged</Badge>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BoardingRollCall;
