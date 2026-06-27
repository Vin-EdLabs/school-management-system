import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import { formatDisplayDate } from '../../utils/dateFormat';
import { cn } from '@/lib/utils';
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

type PaymentType = 'daily' | 'weekly' | 'monthly' | 'termly';
type StudentRow = {
  studentId: number;
  studentName: string;
  studentCode: string;
  admissionNumber: string | null;
  hasPassportPhoto: boolean;
  status: 'covered' | 'paid' | 'pending' | 'school_closed' | 'expired';
  currentPaymentType?: string | null;
  paidUntil: string | null;
  nextDueDate: string | null;
  lastPaymentType: string | null;
  lastPaymentDate: string | null;
  lastPaidUntil: string | null;
  lastPaymentAmount: number | null;
  lastCoverageStart: string | null;
  lastCoverageEnd: string | null;
  lastPaymentMethod: string | null;
};

type StructureRates = {
  daily_rate: number | string;
  weekly_rate: number | string;
  monthly_rate: number | string;
  termly_rate: number | string;
};

type DailyClassRow = {
  id: number;
  class_name: string;
  structure_id: number | null;
  daily_rate?: string;
  weekly_rate?: string;
  monthly_rate?: string;
  termly_rate?: string;
};

type Props = {
  disabled?: boolean;
  initialClassId?: string;
  onClassConsumed?: () => void;
  listKey?: number;
};

const PAYMENT_TYPES: { id: PaymentType; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'termly', label: 'Termly' },
];

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DailyFeeRecordPaymentTab: React.FC<Props> = ({
  disabled,
  initialClassId = '',
  onClassConsumed,
  listKey = 0,
}) => {
  const [dailyClasses, setDailyClasses] = useState<DailyClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [hasStructure, setHasStructure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<StructureRates | null>(null);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [selections, setSelections] = useState<Record<number, PaymentType>>({});
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ totalCollected: 0, paidToday: 0, totalStudents: 0 });
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const rateFor = (type: PaymentType, r: StructureRates | null): number => {
    if (!r) return 0;
    const map: Record<PaymentType, number | string> = {
      daily: r.daily_rate,
      weekly: r.weekly_rate,
      monthly: r.monthly_rate,
      termly: r.termly_rate,
    };
    return parseFloat(String(map[type])) || 0;
  };

  const loadDailyClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const rows = await apiService.get<DailyClassRow[]>('/daily-fees/classes');
      const ready = (Array.isArray(rows) ? rows : []).filter((c) => c.structure_id != null);
      setDailyClasses(ready);
      if (ready.length === 1 && !initialClassId) {
        setClassId(String(ready[0].id));
      }
    } catch {
      setDailyClasses([]);
    } finally {
      setClassesLoading(false);
    }
  }, [initialClassId]);

  useEffect(() => {
    void loadDailyClasses();
  }, [loadDailyClasses, listKey]);

  useEffect(() => {
    if (initialClassId) {
      setClassId(initialClassId);
      onClassConsumed?.();
    }
  }, [initialClassId, onClassConsumed]);

  useEffect(() => {
    setSelections({});
  }, [classId, date]);

  const loadCollections = useCallback(async (quiet = false) => {
    if (!classId) return;
    if (!quiet) setLoading(true);
    try {
      const [coll, sum] = await Promise.all([
        apiService.get<{
          students: StudentRow[];
          hasStructure: boolean;
          structure: StructureRates | null;
        }>(`/daily-fees/collections?classId=${classId}&date=${date}`),
        apiService.get<{ totalCollected: number; paidToday: number; totalStudents: number }>(
          `/daily-fees/payments/summary?classId=${classId}&date=${date}`
        ),
      ]);
      setStudents(coll.students || []);
      const structureOk = coll.hasStructure !== false && !!coll.structure;
      setHasStructure(structureOk);
      setRates(coll.structure);
      setSummary({
        totalCollected: sum.totalCollected || 0,
        paidToday: sum.paidToday || 0,
        totalStudents: sum.totalStudents ?? (coll.students?.length || 0),
      });
    } catch (err: any) {
      if (!quiet) {
        toast({ title: 'Failed to load', description: err?.message, variant: 'destructive' });
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const statusBadge = (s: StudentRow) => {
    switch (s.status) {
      case 'paid':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Paid{s.currentPaymentType ? ` (${s.currentPaymentType})` : ''}
          </Badge>
        );
      case 'covered':
        return (
          <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-100">
            Covered until {formatDisplayDate(s.paidUntil || '')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            Due — last covered {formatDisplayDate(s.lastPaidUntil || '')}
          </Badge>
        );
      case 'school_closed':
        return <Badge variant="secondary">School Closed</Badge>;
      default:
        return <Badge variant="outline">Due today</Badge>;
    }
  };

  const toggleSelection = (studentId: number, pType: PaymentType) => {
    setSelections((prev) => {
      if (prev[studentId] === pType) {
        const next = { ...prev };
        delete next[studentId];
        return next;
      }
      return { ...prev, [studentId]: pType };
    });
  };

  const applySavedPayments = (
    saved: Array<{
      payment: { student_id: number; payment_type: string; amount_paid: string; coverage_end_date: string };
      coverageEndDate: string;
      amount: number;
      paymentType: string;
    }>
  ) => {
    setStudents((prev) =>
      prev.map((s) => {
        const hit = saved.find((r) => Number(r.payment.student_id) === s.studentId);
        if (!hit) return s;
        const pType = hit.paymentType;
        const isMultiDay = pType === 'weekly' || pType === 'monthly' || pType === 'termly';
        return {
          ...s,
          status: isMultiDay ? 'covered' : 'paid',
          currentPaymentType: pType,
          paidUntil: hit.coverageEndDate,
          lastPaymentType: pType,
          lastPaymentDate: date,
          lastPaymentAmount: hit.amount,
          lastCoverageEnd: hit.coverageEndDate,
          lastPaidUntil: hit.coverageEndDate,
        };
      })
    );
    setSummary((prev) => ({
      ...prev,
      paidToday: prev.paidToday + saved.length,
      totalCollected: prev.totalCollected + saved.reduce((sum, r) => sum + r.amount, 0),
    }));
  };

  const saveAll = async () => {
    const entries = Object.entries(selections);
    if (entries.length === 0 || disabled || !hasStructure || saving) return;

    const items = entries.map(([studentId, paymentType]) => ({
      studentId: parseInt(studentId, 10),
      paymentType,
      amountPaid: rateFor(paymentType, rates),
    }));

    setSaving(true);
    try {
      const res = await apiService.post<{
        saved: number;
        payments: Array<{
          payment: { student_id: number; payment_type: string; amount_paid: string; coverage_end_date: string };
          coverageEndDate: string;
          amount: number;
          paymentType: string;
        }>;
      }>('/daily-fees/payments/batch', {
        classId: parseInt(classId, 10),
        paymentDate: date,
        paymentMethod,
        paymentAccountId: paymentAccountId ? parseInt(paymentAccountId, 10) : undefined,
        items,
      });

      const saved = res.payments || [];
      applySavedPayments(saved);
      setSelections({});
      toast({
        title: 'Saved',
        description: `${saved.length} payment${saved.length === 1 ? '' : 's'} recorded.`,
      });
      void loadCollections(true);
    } catch (err: any) {
      toast({ title: 'Could not save', description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const markTodayClosed = async () => {
    try {
      await apiService.post('/daily-fees/closure-days', { closureDate: date, reason: 'Marked from daily collections' });
      toast({ title: 'School closed for this date' });
      setShowCloseConfirm(false);
      void loadCollections(true);
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  const singleClass = dailyClasses.length === 1;
  const className = dailyClasses.find((c) => String(c.id) === classId)?.class_name || '';
  const selectionCount = Object.keys(selections).length;
  const selectionTotal = Object.values(selections).reduce((sum, pt) => sum + rateFor(pt, rates), 0);

  return (
    <div className="space-y-4">
      <Card className="border-emerald-100/80 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">
            {singleClass && className ? `Collecting — ${className}` : 'Select class to collect'}
          </CardTitle>
          {!singleClass && (
            <p className="text-sm text-muted-foreground">Choose a daily-fee class, tick payments, then save</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {classesLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
            </div>
          ) : dailyClasses.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              No daily-fee classes ready yet. Go to <strong>Fee Structure</strong>, set up a class, and save.
            </p>
          ) : !singleClass ? (
            <div className="flex flex-wrap gap-2">
              {dailyClasses.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant={String(c.id) === classId ? 'default' : 'outline'}
                  className={String(c.id) === classId ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  onClick={() => setClassId(String(c.id))}
                  disabled={disabled}
                >
                  {c.class_name}
                  {c.daily_rate ? ` · GHS ${parseFloat(String(c.daily_rate)).toFixed(2)}/day` : ''}
                </Button>
              ))}
            </div>
          ) : null}

          <div className={cn('flex flex-wrap gap-4', !singleClass && 'border-t pt-4')}>
            {!singleClass && (
              <div className="min-w-[200px] flex-1 space-y-2">
                <Label>Class</Label>
                <Select value={classId} onValueChange={setClassId} disabled={disabled || dailyClasses.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={dailyClasses.length ? 'Select class' : 'No classes yet'} />
                  </SelectTrigger>
                  <SelectContent>
                    {dailyClasses.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.class_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Collection date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasStructure && classId && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Daily fee structure not set for this class. Complete setup on the Fee Structure tab before collecting.
        </div>
      )}

      {classId && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <CardTitle className="text-lg">Students{className ? ` — ${className}` : ''}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Tick fee boxes, then press Save. Receipts are available in Payment History.
              </p>
            </div>
            <div className="w-full sm:w-56">
              <PaymentAccountSelect
                value={paymentAccountId}
                onChange={(id, method) => {
                  setPaymentAccountId(id);
                  setPaymentMethod(method);
                }}
                disabled={disabled || saving}
                label="Payment method"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              </div>
            ) : students.length === 0 ? (
              <p className="text-sm text-slate-500">No active students in this class.</p>
            ) : (
              <div className="space-y-3">
                {students.map((s) => {
                  const canCollect =
                    (s.status === 'pending' || s.status === 'expired') && hasStructure && !disabled;
                  const selectedType = selections[s.studentId];

                  return (
                    <div
                      key={s.studentId}
                      className={cn(
                        'flex flex-col gap-3 rounded-xl border p-4 transition-colors lg:flex-row lg:items-center lg:justify-between',
                        selectedType && 'border-emerald-300 bg-emerald-50/30'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{s.studentName}</p>
                          <span className="font-mono text-xs text-slate-500">{s.studentCode}</span>
                        </div>
                        <div className="mt-2">{statusBadge(s)}</div>
                      </div>

                      {canCollect && (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-xl">
                          {PAYMENT_TYPES.filter((pt) => rateFor(pt.id, rates) > 0).map((pt) => {
                            const amt = rateFor(pt.id, rates);
                            const checked = selectedType === pt.id;
                            return (
                              <label
                                key={pt.id}
                                className={cn(
                                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                                  checked
                                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200'
                                    : 'hover:border-emerald-400 hover:bg-emerald-50/50',
                                  saving && 'pointer-events-none opacity-60'
                                )}
                              >
                                <Checkbox
                                  checked={checked}
                                  disabled={saving}
                                  onCheckedChange={() => toggleSelection(s.studentId, pt.id)}
                                  className="shrink-0 data-[state=checked]:border-emerald-600 data-[state=checked]:bg-emerald-600"
                                />
                                <span className="leading-tight">
                                  <span className="block font-medium">{pt.label}</span>
                                  <span className="block text-xs text-slate-600">GHS {money(amt)}</span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm font-medium">
                {summary.totalStudents || students.length} student{(summary.totalStudents || students.length) === 1 ? '' : 's'}
                {' · '}
                {summary.paidToday} paid today — GHS {summary.totalCollected.toFixed(2)}
                {selectionCount > 0 && (
                  <span className="ml-2 text-emerald-700">
                    ({selectionCount} selected — GHS {money(selectionTotal)})
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={disabled || saving}
                >
                  Mark School Closed
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => void saveAll()}
                  disabled={disabled || saving || selectionCount === 0 || !hasStructure}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save {selectionCount > 0 ? `(${selectionCount})` : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark school closed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark <strong>{formatDisplayDate(date)}</strong> as a non-school day for daily fee collections.
              Students will not be charged for this date, and anyone with active weekly or monthly coverage will have
              their coverage extended by one school day. This cannot be undone from here except by removing the closure
              on the Fee Structure tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void markTodayClosed()}>Confirm closure</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DailyFeeRecordPaymentTab;
