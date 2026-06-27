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
import { Download, Loader2, Receipt } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { formatDisplayDate } from '../../utils/dateFormat';

type PaymentRow = {
  id: number;
  payment_date: string;
  first_name: string;
  last_name: string;
  student_code: string;
  admission_number: string;
  class_name: string;
  payment_type: string;
  amount_paid: string;
  coverage_start_date: string;
  coverage_end_date: string;
  next_due_date: string | null;
  payment_method: string;
  receipt_number: string;
};

type Props = { disabled?: boolean };

const DailyFeePaymentHistoryTab: React.FC<Props> = ({ disabled }) => {
  const { classes } = useData();
  const dailyClasses = useMemo(
    () => classes.filter((c) => c.feeMode === 'daily'),
    [classes]
  );

  const [classId, setClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [breakdown, setBreakdown] = useState<{ payment_type: string; total: string; count: number }[]>([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const limit = 25;

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (classId) q.set('classId', classId);
      if (paymentType) q.set('paymentType', paymentType);
      if (startDate) q.set('startDate', startDate);
      if (endDate) q.set('endDate', endDate);
      q.set('page', String(page));
      q.set('limit', String(limit));

      const data = await apiService.get<{
        payments: PaymentRow[];
        total: number;
        totalCollected: number;
        breakdown: { payment_type: string; total: string; count: number }[];
      }>(`/daily-fees/payments?${q.toString()}`);

      let rows = data.payments || [];
      if (studentSearch.trim()) {
        const q = studentSearch.toLowerCase();
        rows = rows.filter(
          (p) =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
            String(p.student_code || '').toLowerCase().includes(q) ||
            String(p.admission_number || '').toLowerCase().includes(q)
        );
      }
      setPayments(rows);
      setTotal(data.total || 0);
      setTotalCollected(data.totalCollected || 0);
      setBreakdown(data.breakdown || []);
    } catch (err: any) {
      toast({ title: 'Failed to load history', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [classId, paymentType, startDate, endDate, page, studentSearch]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const exportCsv = () => {
    const headers = ['Date', 'Student', 'ID', 'Class', 'Type', 'Amount', 'Covers From', 'Covers To', 'Next Due', 'Method', 'Receipt'];
    const lines = payments.map((p) =>
      [
        p.payment_date?.slice(0, 10),
        `${p.first_name} ${p.last_name}`,
        p.admission_number || p.student_code,
        p.class_name,
        p.payment_type,
        p.amount_paid,
        p.coverage_start_date?.slice(0, 10),
        p.coverage_end_date?.slice(0, 10),
        p.next_due_date?.slice(0, 10) || '',
        p.payment_method,
        p.receipt_number,
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-fee-payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openReceipt = (p: PaymentRow) => {
    setReceiptData({
      studentName: `${p.first_name} ${p.last_name}`,
      studentId: p.admission_number || p.student_code,
      className: p.class_name,
      amount: parseFloat(p.amount_paid),
      date: p.payment_date?.slice(0, 10),
      paymentMethod: p.payment_method,
      term: '',
      receiptNumber: p.receipt_number,
      isDailyFee: true,
      dailyFeeType: p.payment_type,
      coverageStart: p.coverage_start_date?.slice(0, 10),
      coverageEnd: p.coverage_end_date?.slice(0, 10),
      notes: `Daily Fee — ${p.payment_type}`,
    });
    setShowReceipt(true);
  };

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = {
      daily: 'bg-blue-100 text-blue-800',
      weekly: 'bg-violet-100 text-violet-800',
      monthly: 'bg-amber-100 text-amber-800',
      termly: 'bg-emerald-100 text-emerald-800',
    };
    return (
      <Badge className={colors[t] || ''}>
        {t.charAt(0).toUpperCase() + t.slice(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-2">
          <Label>Class</Label>
          <Select value={classId || 'all'} onValueChange={(v) => { setClassId(v === 'all' ? '' : v); setPage(1); }} disabled={disabled}>
            <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {dailyClasses.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.className}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Student search</Label>
          <Input value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} placeholder="Name or ID" />
        </div>
        <div className="space-y-2">
          <Label>From</Label>
          <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-2">
          <Label>To</Label>
          <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-2">
          <Label>Payment type</Label>
          <Select value={paymentType || 'all'} onValueChange={(v) => { setPaymentType(v === 'all' ? '' : v); setPage(1); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="termly">Termly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Summary</CardTitle>
            <p className="text-sm text-slate-600">
              Total collected: GHS {totalCollected.toFixed(2)}
              {breakdown.length > 0 && (
                <span className="ml-2">
                  ({breakdown.map((b) => `${b.payment_type}: GHS ${Number(b.total).toFixed(2)}`).join(' · ')})
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={payments.length === 0}>
            <Download className="mr-1 h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Student</th>
                    <th className="py-2 pr-3">Class</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Covers</th>
                    <th className="py-2 pr-3">Next Due</th>
                    <th className="py-2 pr-3">Method</th>
                    <th className="py-2">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-b border-slate-100">
                      <td className="py-3 pr-3">{formatDisplayDate(p.payment_date?.slice(0, 10))}</td>
                      <td className="py-3 pr-3">
                        <div>{p.first_name} {p.last_name}</div>
                        <div className="text-xs text-slate-500">{p.admission_number || p.student_code}</div>
                      </td>
                      <td className="py-3 pr-3">{p.class_name}</td>
                      <td className="py-3 pr-3">{typeBadge(p.payment_type)}</td>
                      <td className="py-3 pr-3">GHS {parseFloat(p.amount_paid).toFixed(2)}</td>
                      <td className="py-3 pr-3 text-xs">
                        {formatDisplayDate(p.coverage_start_date?.slice(0, 10))} → {formatDisplayDate(p.coverage_end_date?.slice(0, 10))}
                      </td>
                      <td className="py-3 pr-3">{p.next_due_date ? formatDisplayDate(p.next_due_date.slice(0, 10)) : '—'}</td>
                      <td className="py-3 pr-3">{p.payment_method}</td>
                      <td className="py-3">
                        <Button size="sm" variant="ghost" onClick={() => openReceipt(p)}>
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {payments.length === 0 && <p className="py-6 text-center text-slate-500">No payments found.</p>}
            </div>
          )}

          {total > limit && (
            <div className="mt-4 flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="flex items-center text-sm text-slate-600">Page {page} of {Math.ceil(total / limit)}</span>
              <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>

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

export default DailyFeePaymentHistoryTab;
