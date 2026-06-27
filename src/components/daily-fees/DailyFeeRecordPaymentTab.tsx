import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { Loader2, Receipt } from 'lucide-react';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { formatDisplayDate } from '../../utils/dateFormat';
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
  admissionNumber: string;
  hasPassportPhoto: boolean;
  status: 'covered' | 'pending' | 'school_closed' | 'expired';
  paidUntil: string | null;
  nextDueDate: string | null;
  lastPaymentType: string | null;
  lastPaymentDate: string | null;
  lastPaidUntil: string | null;
};

type StructureRates = {
  daily_rate: string;
  weekly_rate: string;
  monthly_rate: string;
  termly_rate: string;
};

type Props = { disabled?: boolean };

const PAYMENT_TYPES: { id: PaymentType; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'termly', label: 'Termly' },
];

const DailyFeeRecordPaymentTab: React.FC<Props> = ({ disabled }) => {
  const { classes } = useData();
  const dailyClasses = useMemo(
    () => classes.filter((c) => c.feeMode === 'daily'),
    [classes]
  );

  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [hasStructure, setHasStructure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<StructureRates | null>(null);
  const [rowTypes, setRowTypes] = useState<Record<number, PaymentType>>({});
  const [rowAmounts, setRowAmounts] = useState<Record<number, string>>({});
  const [rowAccounts, setRowAccounts] = useState<Record<number, { id: string; method: string }>>({});
  const [confirmRow, setConfirmRow] = useState<StudentRow | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [summary, setSummary] = useState({ totalCollected: 0, paidToday: 0 });
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  const rateFor = (type: PaymentType, r: StructureRates | null): number => {
    if (!r) return 0;
    const map: Record<PaymentType, string> = {
      daily: r.daily_rate,
      weekly: r.weekly_rate,
      monthly: r.monthly_rate,
      termly: r.termly_rate,
    };
    return parseFloat(map[type]) || 0;
  };

  const loadCollections = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const [coll, struct, sum] = await Promise.all([
        apiService.get<{ students: StudentRow[]; hasStructure: boolean }>(
          `/daily-fees/collections?classId=${classId}&date=${date}`
        ),
        apiService.get<{ structure: StructureRates | null }>(`/daily-fees/structure/${classId}`),
        apiService.get<{ totalCollected: number; paidToday: number }>(
          `/daily-fees/payments/summary?classId=${classId}&date=${date}`
        ),
      ]);
      setStudents(coll.students || []);
      setHasStructure(coll.hasStructure !== false);
      setRates(struct.structure);
      setSummary({ totalCollected: sum.totalCollected || 0, paidToday: sum.paidToday || 0 });

      const types: Record<number, PaymentType> = {};
      const amounts: Record<number, string> = {};
      for (const s of coll.students || []) {
        if (s.status === 'pending' || s.status === 'expired') {
          types[s.studentId] = 'daily';
          amounts[s.studentId] = String(rateFor('daily', struct.structure));
        }
      }
      setRowTypes(types);
      setRowAmounts(amounts);
    } catch (err: any) {
      toast({ title: 'Failed to load', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [classId, date]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const statusBadge = (s: StudentRow) => {
    switch (s.status) {
      case 'covered':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
            Covered until {formatDisplayDate(s.paidUntil || '')}
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="destructive">
            Expired since {formatDisplayDate(s.lastPaidUntil || '')}
          </Badge>
        );
      case 'school_closed':
        return <Badge variant="secondary">School Closed</Badge>;
      default:
        return <Badge variant="outline">Due today</Badge>;
    }
  };

  const handleCollect = async (student: StudentRow) => {
    const pType = rowTypes[student.studentId] || 'daily';
    const amount = parseFloat(rowAmounts[student.studentId] || '0');
    const acct = rowAccounts[student.studentId];
    if (!amount || amount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setCollecting(true);
    try {
      const res = await apiService.post<any>('/daily-fees/payments', {
        studentId: student.studentId,
        classId: parseInt(classId, 10),
        paymentType: pType,
        amountPaid: amount,
        paymentDate: date,
        paymentMethod: acct?.method || 'Cash',
        paymentAccountId: acct?.id ? parseInt(acct.id, 10) : undefined,
      });
      const cls = dailyClasses.find((c) => String(c.id) === classId);
      setReceiptData({
        studentName: res.studentName,
        studentId: student.admissionNumber,
        className: cls?.className || '',
        amount,
        date,
        paymentMethod: acct?.method || 'Cash',
        term: res.termLabel || '',
        receiptNumber: res.receiptNumber,
        isDailyFee: true,
        dailyFeeType: pType,
        coverageStart: String(res.payment?.coverage_start_date || '').slice(0, 10) || undefined,
        coverageEnd: res.coverageEndDate,
        recordedBy: res.receiptSnapshot?.recordedBy,
        notes: `Daily Fee — ${pType}`,
      });
      setShowReceipt(true);
      toast({ title: 'Payment recorded' });
      await loadCollections();
    } catch (err: any) {
      toast({ title: 'Collection failed', description: err?.message, variant: 'destructive' });
    } finally {
      setCollecting(false);
      setConfirmRow(null);
    }
  };

  const markTodayClosed = async () => {
    try {
      await apiService.post('/daily-fees/closure-days', { closureDate: date, reason: 'Marked from daily collections' });
      toast({ title: 'Today marked as school closed' });
      await loadCollections();
    } catch (err: any) {
      toast({ title: 'Failed', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap gap-4 pt-6">
          <div className="min-w-[200px] flex-1 space-y-2">
            <Label>Class (daily fee mode)</Label>
            <Select value={classId} onValueChange={setClassId} disabled={disabled}>
              <SelectTrigger>
                <SelectValue placeholder={dailyClasses.length ? 'Select class' : 'No daily-fee classes yet'} />
              </SelectTrigger>
              <SelectContent>
                {dailyClasses.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dailyClasses.length === 0 && (
              <p className="text-xs text-amber-700">Set up a class on the Fee Structure tab first.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Collection date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled} />
          </div>
        </CardContent>
      </Card>

      {!hasStructure && classId && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Daily fee structure not set for this class. Complete setup on the Fee Structure tab before collecting.
        </div>
      )}

      {classId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Students</CardTitle>
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
                  const canCollect = (s.status === 'pending' || s.status === 'expired') && hasStructure && !disabled;
                  const pType = rowTypes[s.studentId] || 'daily';
                  return (
                    <div
                      key={s.studentId}
                      className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-medium">{s.studentName}</p>
                        <p className="text-xs text-slate-500">{s.admissionNumber}</p>
                        <div className="mt-2">{statusBadge(s)}</div>
                      </div>
                      {canCollect && (
                        <div className="flex flex-wrap items-end gap-2">
                          <div className="flex gap-1">
                            {PAYMENT_TYPES.map((pt) => (
                              <Button
                                key={pt.id}
                                size="sm"
                                variant={pType === pt.id ? 'default' : 'outline'}
                                onClick={() => {
                                  setRowTypes((prev) => ({ ...prev, [s.studentId]: pt.id }));
                                  setRowAmounts((prev) => ({
                                    ...prev,
                                    [s.studentId]: String(rateFor(pt.id, rates)),
                                  }));
                                }}
                              >
                                {pt.label}
                              </Button>
                            ))}
                          </div>
                          <Input
                            className="w-24"
                            type="number"
                            value={rowAmounts[s.studentId] || ''}
                            onChange={(e) =>
                              setRowAmounts((prev) => ({ ...prev, [s.studentId]: e.target.value }))
                            }
                          />
                          <div className="w-40">
                            <PaymentAccountSelect
                              value={rowAccounts[s.studentId]?.id}
                              onChange={(id, method) =>
                                setRowAccounts((prev) => ({
                                  ...prev,
                                  [s.studentId]: { id, method },
                                }))
                              }
                            />
                          </div>
                          <Button size="sm" onClick={() => setConfirmRow(s)}>
                            Collect
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <p className="text-sm font-medium">
                {summary.paidToday} collected today — GHS {summary.totalCollected.toFixed(2)}
              </p>
              <Button variant="outline" size="sm" onClick={markTodayClosed} disabled={disabled}>
                Mark School Closed for Today
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!confirmRow} onOpenChange={(o) => !o && setConfirmRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm collection</AlertDialogTitle>
            <AlertDialogDescription>
              Collect GHS {rowAmounts[confirmRow?.studentId || 0] || '0'} from {confirmRow?.studentName} —{' '}
              {rowTypes[confirmRow?.studentId || 0] || 'daily'} payment?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={collecting}
              onClick={() => confirmRow && handleCollect(confirmRow)}
            >
              {collecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {receiptData && (
        <ReceiptPrinter
          show={showReceipt}
          receiptData={receiptData}
          onPrint={() => setShowReceipt(false)}
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  );
};

export default DailyFeeRecordPaymentTab;
