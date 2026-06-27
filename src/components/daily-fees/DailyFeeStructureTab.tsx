import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
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

type Props = { disabled?: boolean };

const DailyFeeStructureTab: React.FC<Props> = ({ disabled }) => {
  const { classes, refresh } = useData();
  const [classId, setClassId] = useState('');
  const [feeMode, setFeeMode] = useState<'term' | 'daily'>('term');
  const [schoolDays, setSchoolDays] = useState('60');
  const [dailyRate, setDailyRate] = useState('');
  const [weeklyRate, setWeeklyRate] = useState('');
  const [monthlyRate, setMonthlyRate] = useState('');
  const [termlyRate, setTermlyRate] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closures, setClosures] = useState<ClosureDay[]>([]);
  const [closureDate, setClosureDate] = useState('');
  const [closureReason, setClosureReason] = useState('');
  const [showClosureForm, setShowClosureForm] = useState(false);

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
        const days = String(s.school_days_count || 60);
        setSchoolDays(days);
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
        toast({ title: 'Daily fee structure saved' });
      }
      await refresh(['classes']);
      await loadStructure(classId);
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
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

  const handleDeleteClosure = async (id: number) => {
    try {
      await apiService.delete(`/daily-fees/closure-days/${id}`);
      await loadClosures();
      toast({ title: 'Closure day removed' });
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Class & Fee Mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Select class</Label>
            <Select value={classId} onValueChange={setClassId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={dailyRate}
                          onChange={(e) => handleDailyRateChange(e.target.value)}
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Weekly rate (GHS)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={weeklyRate}
                          onChange={(e) => setWeeklyRate(e.target.value)}
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Monthly rate (GHS)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={monthlyRate}
                          onChange={(e) => setMonthlyRate(e.target.value)}
                          disabled={disabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Termly rate (GHS)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={termlyRate}
                          onChange={(e) => setTermlyRate(e.target.value)}
                          disabled={disabled}
                        />
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
                    onClick={() => handleDeleteClosure(c.id)}
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
              Students with active coverage on this date will have their coverage extended by one school day.
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
    </div>
  );
};

export default DailyFeeStructureTab;
