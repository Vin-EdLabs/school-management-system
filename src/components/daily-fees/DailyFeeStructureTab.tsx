import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { feeStructureCheckKey } from '../../hooks/useFeeStructureCheck';
import { toast } from '@/hooks/use-toast';
import { CreditCard, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
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

type ClosureDay = { id: number; closure_date: string; reason?: string };

type DailyStructureRow = {
  id: number;
  class_id: number;
  class_name: string;
  school_days_count: number;
  daily_rate: string;
  weekly_rate: string;
  monthly_rate: string;
  termly_rate: string;
};

type Props = {
  disabled?: boolean;
  currentTerm?: string;
  listKey?: number;
  onStructureSaved?: () => void;
  onCollectClass?: (classId: string) => void;
};

const DailyFeeStructureTab: React.FC<Props> = ({
  disabled,
  currentTerm,
  listKey = 0,
  onStructureSaved,
  onCollectClass,
}) => {
  const queryClient = useQueryClient();
  const { classes, feeStructures, refresh } = useData();
  const [classId, setClassId] = useState('');
  const [feeMode, setFeeMode] = useState<'term' | 'daily'>('term');
  const [schoolDays, setSchoolDays] = useState('60');
  const [dailyRate, setDailyRate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [termlyRate, setTermlyRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [structures, setStructures] = useState<DailyStructureRow[]>([]);
  const [structuresLoading, setStructuresLoading] = useState(false);
  const [closures, setClosures] = useState<ClosureDay[]>([]);
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [showClosureForm, setShowClosureForm] = useState(false);
  const [deleteClosureId, setDeleteClosureId] = useState<number | null>(null);

  const loadStructuresList = useCallback(async () => {
    setStructuresLoading(true);
    try {
      const data = await apiService.get<{ structures: DailyStructureRow[] }>('/daily-fees/structures');
      setStructures(Array.isArray(data.structures) ? data.structures : []);
    } catch {
      setStructures([]);
    } finally {
      setStructuresLoading(false);
    }
  }, []);

  const loadStructure = useCallback(async (cid: string) => {
    if (!cid) return;
    setLoading(true);
    try {
      const data = await apiService.get<{
        class: { fee_mode: string };
        structure: {
          school_days_count: number;
          daily_rate: string;
          weekly_rate: string;
          monthly_rate: string;
          termly_rate: string;
        } | null;
      }>(`/daily-fees/structure/${cid}`);
      const mode = (data.class?.fee_mode || 'term') as 'term' | 'daily';
      setFeeMode(mode);
      if (data.structure) {
        const s = data.structure;
        setSchoolDays(String(s.school_days_count || 60));
        setDailyRate(String(s.daily_rate || ''));
        setWeeklyRate(String(s.weekly_rate || ''));
        setMonthlyRate(String(s.monthly_rate || ''));
        setTermlyRate(String(s.termly_rate || ''));
      } else {
        setSchoolDays('60');
        setDailyRate('');
        setWeeklyRate('');
        setMonthlyRate('');
        setTermlyRate('');
      }
    } catch (err: any) {
      toast({ title: 'Failed to load structure', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadClosures = useCallback(async () => {
    try {
      const rows = await apiService.get<ClosureDay[]>('/daily-fees/closure-days');
      setClosures(Array.isArray(rows) ? rows : []);
    } catch {
      setClosures([]);
    }
  }, []);

  useEffect(() => {
    void loadStructuresList();
  }, [loadStructuresList, listKey]);

  useEffect(() => {
    if (classId) void loadStructure(classId);
  }, [classId, loadStructure]);

  useEffect(() => {
    void loadClosures();
  }, [loadClosures]);

  const suggestRates = (daily: number, days: number) => {
    if (daily > 0) {
      setWeeklyRate(String((daily * 5).toFixed(2)));
      setMonthlyRate(String((daily * 20).toFixed(2)));
      setTermlyRate(String((daily * days).toFixed(2)));
    }
  };

  const handleDailyRateChange = (val: string) => {
    setDailyRate(val);
    const d = parseFloat(val);
    const days = parseInt(schoolDays, 10) || 60;
    if (!Number.isNaN(d) && d > 0) suggestRates(d, days);
  };

  const handleSchoolDaysChange = (val: string) => {
    setSchoolDays(val);
    const d = parseFloat(dailyRate);
    const days = parseInt(val, 10) || 60;
    if (!Number.isNaN(d) && d > 0) suggestRates(d, days);
  };

  const handleSave = async () => {
    if (!classId) return;
    setSaving(true);
    try {
      if (feeMode === 'term') {
        await apiService.delete(`/daily-fees/structure/${classId}`);
        toast({ title: 'Class switched to term fees' });
      } else {
        const days = parseInt(schoolDays, 10);
        if (!days || days < 1) {
          toast({ title: 'Enter total school days', variant: 'destructive' });
          return;
        }
        await apiService.post('/daily-fees/structure', {
          classId: parseInt(classId, 10),
          feeMode: 'daily',
          schoolDaysCount: days,
          dailyRate: parseFloat(dailyRate) || 0,
          weeklyRate: parseFloat(weeklyRate) || 0,
          monthlyRate: parseFloat(monthlyRate) || 0,
          termlyRate: parseFloat(termlyRate) || 0,
        });
        toast({ title: 'Daily fee structure saved', description: 'Class is ready for collections.' });
      }
      await refresh(['classes']);
      void queryClient.invalidateQueries({ queryKey: feeStructureCheckKey() });
      onStructureSaved?.();
      await loadStructuresList();
      await loadStructure(classId);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleEditStructure = (row: DailyStructureRow) => {
    setClassId(String(row.class_id));
    setFeeMode('daily');
    setSchoolDays(String(row.school_days_count));
    setDailyRate(String(row.daily_rate));
    setWeeklyRate(String(row.weekly_rate));
    setMonthlyRate(String(row.monthly_rate));
    setTermlyRate(String(row.termly_rate));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddClosure = async () => {
    if (!closureDate) return;
    try {
      await apiService.post('/daily-fees/closure-days', {
        closureDate,
        reason: closureReason || undefined,
      });
      setClosureDate('');
      setClosureReason('');
      setShowClosureForm(false);
      await loadClosures();
      toast({ title: 'Closure day marked' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDeleteClosure = async () => {
    if (deleteClosureId == null) return;
    try {
      await apiService.delete(`/daily-fees/closure-days/${deleteClosureId}`);
      await loadClosures();
      setDeleteClosureId(null);
      toast({ title: 'Closure day removed' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  const money = (v: string | number) => `GHS ${parseFloat(String(v)).toFixed(2)}`;

  /** Daily classes + classes not yet on term fees — hide term-fee-configured classes. */
  const selectableClasses = useMemo(() => {
    const normTerm = String(currentTerm || '').trim();
    const termConfiguredIds = new Set(
      (feeStructures || [])
        .filter((f) => {
          if (!normTerm || normTerm === 'Not Set') return false;
          const feeClassId = f.classId ?? (f as { class_id?: number }).class_id;
          if (feeClassId == null) return false;
          const term = String(f.term || '').trim();
          return (
            !term ||
            term === normTerm ||
            term.startsWith(normTerm) ||
            normTerm.startsWith(term)
          );
        })
        .map((f) => String(f.classId ?? (f as { class_id?: number }).class_id))
    );

    return (classes || []).filter((c) => {
      if (!c.className?.trim()) return false;
      if (c.feeMode === 'daily') return true;
      if (termConfiguredIds.has(String(c.id))) return false;
      return true;
    });
  }, [classes, feeStructures, currentTerm]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add or update class</CardTitle>
          <p className="text-sm text-muted-foreground">
            Select a class and switch it to daily fee mode. Classes already on term fees are hidden.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select class</Label>
            <Select value={classId} onValueChange={setClassId} disabled={disabled || selectableClasses.length === 0}>
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    selectableClasses.length === 0
                      ? 'No eligible classes (term-fee classes hidden)'
                      : 'Choose a class'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {selectableClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.className}
                    {c.feeMode === 'daily' ? ' (Daily)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectableClasses.length === 0 ? (
              <p className="text-xs text-amber-700">
                All classes are already on term fees. Use the main Fees module for those classes.
              </p>
            ) : null}
          </div>

          {classId && (
            <>
              {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={feeMode === 'term' ? 'default' : 'outline'}
                      onClick={() => setFeeMode('term')}
                      disabled={disabled}
                    >
                      Term Fees
                    </Button>
                    <Button
                      type="button"
                      variant={feeMode === 'daily' ? 'default' : 'outline'}
                      onClick={() => setFeeMode('daily')}
                      disabled={disabled}
                    >
                      Daily Fees
                    </Button>
                  </div>

                  {feeMode === 'daily' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Total school days this term</Label>
                        <Input
                          type="number"
                          min={1}
                          value={schoolDays}
                          onChange={(e) => handleSchoolDaysChange(e.target.value)}
                          disabled={disabled}
                          placeholder="e.g. 65 — enter manually, not from term dates"
                        />
                        <p className="text-xs text-slate-500">
                          Admin-entered count of planned school days for this term (not calculated from term dates).
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Daily rate (GHS)</Label>
                        <Input type="number" min={0} step="0.01" value={dailyRate} onChange={(e) => handleDailyRateChange(e.target.value)} disabled={disabled} />
                      </div>
                      <div className="space-y-2">
                        <Label>Weekly rate (GHS)</Label>
                        <Input type="number" min={0} step="0.01" value={weeklyRate} onChange={(e) => setWeeklyRate(e.target.value)} disabled={disabled} />
                      </div>
                      <div className="space-y-2">
                        <Label>Monthly rate (GHS)</Label>
                        <Input type="number" min={0} step="0.01" value={monthlyRate} onChange={(e) => setMonthlyRate(e.target.value)} disabled={disabled} />
                      </div>
                      <div className="space-y-2">
                        <Label>Termly rate (GHS)</Label>
                        <Input type="number" min={0} step="0.01" value={termlyRate} onChange={(e) => setTermlyRate(e.target.value)} disabled={disabled} />
                      </div>
                    </div>
                  )}

                  <Button onClick={handleSave} disabled={disabled || saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {feeMode === 'daily' ? 'Save Fee Structure' : 'Switch to Term Fees'}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-emerald-200/60 bg-emerald-50/30">
        <CardHeader className="border-b border-emerald-100">
          <CardTitle className="text-lg">Daily fee structures{currentTerm ? ` — ${currentTerm}` : ''}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Classes configured for daily collections. Select one to collect payments.
          </p>
        </CardHeader>
        <CardContent className="pt-6">
          {structuresLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : structures.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No daily fee classes yet. Select a class above, switch to Daily Fees, and save.
            </p>
          ) : (
            <div className="space-y-3">
              {structures.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-emerald-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-slate-900">{row.class_name}</p>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Daily Fees</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {row.school_days_count} school days · Daily {money(row.daily_rate)} · Weekly {money(row.weekly_rate)} · Monthly {money(row.monthly_rate)} · Termly {money(row.termly_rate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEditStructure(row)} disabled={disabled}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => onCollectClass?.(String(row.class_id))}
                      disabled={disabled}
                    >
                      <CreditCard className="mr-1 h-4 w-4" /> Collect payments
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">School Closure Days</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setShowClosureForm(true)} disabled={disabled}>
            <Plus className="mr-1 h-4 w-4" /> Mark Closure Day
          </Button>
        </CardHeader>
        <CardContent>
          {closures.length === 0 ? (
            <p className="text-sm text-slate-500">No closure days marked for the active term.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {closures.map((c) => (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{c.closure_date?.slice(0, 10)}</span>
                    {c.reason && <span className="ml-2 text-slate-500">— {c.reason}</span>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => setDeleteClosureId(c.id)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showClosureForm} onOpenChange={setShowClosureForm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark school closure</AlertDialogTitle>
            <AlertDialogDescription>
              Mark a date when school is closed (holiday, strike, etc.). Students will not be charged daily fees on
              this date. Weekly and monthly payers will have their coverage extended by one school day automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason (optional)</Label>
              <Input value={closureReason} onChange={(e) => setClosureReason(e.target.value)} placeholder="Public holiday" />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAddClosure}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteClosureId != null} onOpenChange={(open) => !open && setDeleteClosureId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove closure day?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the school closure marking for{' '}
              <strong>
                {closures.find((c) => c.id === deleteClosureId)?.closure_date?.slice(0, 10) || 'this date'}
              </strong>
              . Daily fee coverage that was extended because of this closure will be recalculated. Students who were
              marked as not due on that day may show as due again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => void handleDeleteClosure()}
            >
              Remove closure
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyFeeStructureTab;
