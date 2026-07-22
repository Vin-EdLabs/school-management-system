import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from '@/hooks/use-toast';
import {
  createPeriod, deletePeriod, fetchPeriods, updatePeriod, type Period,
} from '@/services/timetableApi';
import { formatTimeRange, toInputTime } from './timetableUtils';

export default function PeriodManager({
  canEdit,
  onPeriodsChanged,
}: {
  canEdit: boolean;
  onPeriodsChanged?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    start_time: '07:30',
    end_time: '08:15',
    is_break: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      setPeriods(await fetchPeriods());
    } catch (e: unknown) {
      toast({ title: 'Could not load periods', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleAdd = async () => {
    if (!canEdit) return;
    const wasBreak = draft.is_break;
    setSaving(true);
    try {
      await createPeriod({
        ...draft,
        name: draft.name.trim() || (draft.is_break ? 'Break' : ''),
      });
      setDraft({ name: '', start_time: '07:30', end_time: '08:15', is_break: false });
      await load();
      onPeriodsChanged?.();
      toast({ title: wasBreak ? 'Break added' : 'Period added' });
    } catch (e: unknown) {
      toast({ title: 'Failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleBreak = async (period: Period, isBreak: boolean) => {
    if (!canEdit) return;
    setSaving(true);
    try {
      await updatePeriod(period.id, { is_break: isBreak });
      await load();
      onPeriodsChanged?.();
    } catch (e: unknown) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const move = async (period: Period, direction: -1 | 1) => {
    if (!canEdit) return;
    const idx = periods.findIndex((p) => p.id === period.id);
    const swap = periods[idx + direction];
    if (!swap) return;
    setSaving(true);
    try {
      await Promise.all([
        updatePeriod(period.id, { order_index: swap.order_index }),
        updatePeriod(swap.id, { order_index: period.order_index }),
      ]);
      await load();
      onPeriodsChanged?.();
    } catch (e: unknown) {
      toast({ title: 'Reorder failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!canEdit || !window.confirm('Delete this period? Timetable slots using it will also be removed.')) return;
    try {
      await deletePeriod(id);
      await load();
      onPeriodsChanged?.();
      toast({ title: 'Period deleted' });
    } catch (e: unknown) {
      toast({ title: 'Delete failed', description: (e as Error).message, variant: 'destructive' });
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50">
          <div>
            <p className="text-sm font-bold text-slate-900">Period manager</p>
            <p className="text-xs text-slate-500">Define time slots — the full grid appears below with period names across the top</p>
          </div>
          <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…</div>
        ) : (
          <>
            <ul className="space-y-2">
              {periods.map((p, idx) => (
                <li
                  key={p.id}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                    p.is_break ? 'border-amber-200 bg-amber-50/70' : 'border-slate-100 bg-slate-50/60'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-800">{p.name}</p>
                      {p.is_break ? (
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
                          Break
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-slate-500">{formatTimeRange(p.start_time, p.end_time)}</p>
                  </div>
                  {canEdit ? (
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <Switch
                          checked={Boolean(p.is_break)}
                          disabled={saving}
                          onCheckedChange={(checked) => void toggleBreak(p, checked)}
                        />
                        Break
                      </label>
                      <Button type="button" size="icon" variant="ghost" disabled={idx === 0 || saving} onClick={() => void move(p, -1)}><ChevronUp className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" disabled={idx === periods.length - 1 || saving} onClick={() => void move(p, 1)}><ChevronDown className="h-4 w-4" /></Button>
                      <Button type="button" size="icon" variant="ghost" className="text-red-600" onClick={() => void handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <Input
                    placeholder={draft.is_break ? 'Break label (optional)' : 'Period name'}
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                  <Input type="time" value={toInputTime(draft.start_time)} onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))} />
                  <Input type="time" value={toInputTime(draft.end_time)} onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))} />
                  <Button
                    onClick={() => void handleAdd()}
                    disabled={saving || (!draft.is_break && !draft.name.trim())}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="mr-2 h-4 w-4" /> {draft.is_break ? 'Add break' : 'Add period'}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  <Switch
                    checked={draft.is_break}
                    onCheckedChange={(checked) => setDraft((d) => ({
                      ...d,
                      is_break: checked,
                      name: checked && !d.name.trim() ? 'Break' : d.name,
                    }))}
                  />
                  Mark as break (break column across all days)
                </label>
              </div>
            ) : null}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
