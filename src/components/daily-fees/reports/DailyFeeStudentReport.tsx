import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CalendarDays,
  Coins,
  Download,
  FileSpreadsheet,
  Loader2,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateFormat';
import { resolveLogoUrl } from '@/services/tenantService';
import { useSchool } from '@/contexts/SchoolContext';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import ReceiptPrinter from '../../common/ReceiptPrinter';
import {
  formatGhs,
  PAYMENT_TYPE_COLORS,
  type StudentDailyFeeReport,
} from '@/services/dailyFeeReportsApi';
import {
  downloadDailyFeeStudentReportPdf,
  exportDailyFeePaymentsCsv,
} from './buildDailyFeeStudentReportPdf';
import CoverageCalendarMap from './CoverageCalendarMap';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

function typeBadge(type: string, label: string) {
  const color = PAYMENT_TYPE_COLORS[type] || '#64748b';
  return (
    <Badge
      className="border-0 text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </Badge>
  );
}

type Props = {
  data: StudentDailyFeeReport | null;
  loading: boolean;
  onBack: () => void;
};

const DailyFeeStudentReport: React.FC<Props> = ({ data, loading, onBack }) => {
  const { school } = useSchool();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);

  const timelineData = useMemo(() => {
    if (!data) return [];
    return data.paymentTimeline.map((p) => ({
      ...p,
      label: formatDisplayDate(p.date),
    }));
  }, [data]);

  const openReceipt = async (paymentId: number) => {
    setReceiptLoading(true);
    try {
      const data = await apiService.post<{
        receiptNumber: string;
        studentName: string;
        studentCode: string;
        admissionNumber: string;
        className: string;
        amount: number;
        paymentDate: string;
        paymentMethod: string;
        paymentType: string;
        coverageStart: string;
        coverageEnd: string;
      }>(`/daily-fees/payments/${paymentId}/receipt`, {});
      setReceiptData({
        studentName: data.studentName,
        studentId: data.admissionNumber || data.studentCode,
        className: data.className,
        amount: data.amount,
        date: data.paymentDate,
        paymentMethod: data.paymentMethod,
        term: data.term || '',
        receiptNumber: data.receiptNumber,
        isDailyFee: true,
        dailyFeeType: data.paymentType,
        coverageStart: data.coverageStart,
        coverageEnd: data.coverageEnd,
        notes: `Daily Fee — ${data.paymentType}`,
      });
      setReceiptOpen(true);
    } catch (err: any) {
      toast({ title: 'Receipt failed', description: err?.message, variant: 'destructive' });
    } finally {
      setReceiptLoading(false);
    }
  };

  const handlePdf = async () => {
    if (!data) return;
    setExportingPdf(true);
    try {
      await downloadDailyFeeStudentReportPdf(data, school?.name || 'School', school?.logo_url);
      toast({ title: 'PDF downloaded' });
    } catch (err: any) {
      toast({ title: 'PDF failed', description: err?.message, variant: 'destructive' });
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-36 rounded-2xl" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  if (!data) return null;

  const initials = data.student.fullName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const photoSrc = data.student.photoUrl ? resolveLogoUrl(data.student.photoUrl) : null;
  const empty = data.payments.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" className="w-fit rounded-xl" onClick={onBack}>
          ← Back to Class Overview
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={exportingPdf}
            onClick={() => void handlePdf()}
          >
            {exportingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => exportDailyFeePaymentsCsv(data)}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden rounded-2xl border-emerald-100 shadow-sm">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-20 w-20 rounded-2xl border-2 border-white shadow">
            {photoSrc ? <AvatarImage src={photoSrc} alt="" className="object-cover" /> : null}
            <AvatarFallback className="rounded-2xl bg-emerald-100 text-lg text-emerald-800">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">{data.student.fullName}</h2>
            <p className="text-sm text-slate-600">
              ID: {data.student.studentId}
              {data.student.admissionNumber ? ` · Adm: ${data.student.admissionNumber}` : ''} ·{' '}
              {data.student.className}
            </p>
            <p className="mt-1 text-sm text-slate-500">Term: {data.term.label}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant="secondary">{formatGhs(data.summary.totalPaid)} paid</Badge>
              <Badge variant="outline">{data.summary.paymentCount} payments</Badge>
              <Badge variant="outline">{data.summary.daysCovered} days covered</Badge>
              <Badge
                className={
                  data.summary.currentStatus === 'Covered'
                    ? 'bg-emerald-100 text-emerald-800'
                    : data.summary.currentStatus === 'Expired'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-700'
                }
              >
                {data.summary.currentStatus}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {empty ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="flex flex-col items-center py-16 text-center">
            <Coins className="mb-4 h-12 w-12 text-slate-300" />
            <p className="text-lg font-medium text-slate-700">No payments recorded yet for this term</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Total Paid This Term</p>
                <p className="mt-1 text-2xl font-bold">{formatGhs(data.summary.totalPaid)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Days Covered</p>
                <p className="mt-1 text-2xl font-bold">{data.summary.daysCovered}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Average Payment</p>
                <p className="mt-1 text-2xl font-bold">{formatGhs(data.summary.averagePayment)}</p>
              </CardContent>
            </Card>
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="pt-5">
                <p className="text-sm text-slate-500">Next Due Date</p>
                <p className="mt-1 text-2xl font-bold">
                  {data.summary.nextDueDate ? formatDisplayDate(data.summary.nextDueDate) : 'Up to date'}
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-1">
            <Card className="rounded-2xl shadow-sm lg:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Payment Timeline — {data.student.fullName}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} width={48} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value: number) => [formatGhs(value), 'Cumulative']}
                        labelFormatter={(_, payload) => {
                          const row = payload?.[0]?.payload;
                          if (!row) return '';
                          return `${row.label} · ${formatGhs(row.amount)} ${row.paymentTypeLabel} · ${formatDisplayDate(row.coverageStart)} → ${formatDisplayDate(row.coverageEnd)}`;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="cumulative"
                        stroke="#10b981"
                        strokeWidth={2}
                        fill="url(#cumFill)"
                        dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                        animationDuration={700}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="h-4 w-4 text-emerald-600" />
                  Coverage Map — {data.term.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <CoverageCalendarMap
                  days={data.coverageCalendar}
                  closureDays={data.closureDays}
                  termLabel={data.term.label}
                />
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Covers From</TableHead>
                    <TableHead>Covers To</TableHead>
                    <TableHead>School Days</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Receipt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((p, i) => (
                    <TableRow key={p.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{formatDisplayDate(p.date)}</TableCell>
                      <TableCell>{typeBadge(p.type, p.typeLabel)}</TableCell>
                      <TableCell>{formatGhs(p.amount)}</TableCell>
                      <TableCell>{formatDisplayDate(p.coversFrom)}</TableCell>
                      <TableCell>{formatDisplayDate(p.coversTo)}</TableCell>
                      <TableCell>{p.schoolDays}</TableCell>
                      <TableCell>{p.method}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={receiptLoading}
                          onClick={() => void openReceipt(p.id)}
                        >
                          <Receipt className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-50 font-semibold">
                    <TableCell colSpan={3}>Total</TableCell>
                    <TableCell>{formatGhs(data.accountSummary.totalAmountPaid)}</TableCell>
                    <TableCell colSpan={2} />
                    <TableCell>
                      {data.payments.reduce((s, p) => s + p.schoolDays, 0)} days
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-slate-50/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Account Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-500">Term:</span>{' '}
                <span className="font-medium">{data.accountSummary.termLabel}</span>
              </p>
              <p>
                <span className="text-slate-500">Total School Days in Term:</span>{' '}
                <span className="font-medium">{data.accountSummary.totalSchoolDays}</span>
              </p>
              <p>
                <span className="text-slate-500">Days Covered by Payments:</span>{' '}
                <span className="font-medium">{data.accountSummary.daysCovered}</span>
              </p>
              <p>
                <span className="text-slate-500">Days Not Covered:</span>{' '}
                <span className="font-medium">{data.accountSummary.daysNotCovered}</span>
              </p>
              <p>
                <span className="text-slate-500">Total Amount Paid:</span>{' '}
                <span className="font-medium">{formatGhs(data.accountSummary.totalAmountPaid)}</span>
              </p>
              <p>
                <span className="text-slate-500">Current Coverage Status:</span>{' '}
                <span className="font-medium">{data.accountSummary.coverageStatusLabel}</span>
              </p>
              <p className="sm:col-span-2">
                <span className="text-slate-500">Rates:</span>{' '}
                <span className="font-medium">
                  Daily {formatGhs(data.accountSummary.rates.daily)} · Weekly{' '}
                  {formatGhs(data.accountSummary.rates.weekly)} · Monthly{' '}
                  {formatGhs(data.accountSummary.rates.monthly)} · Termly{' '}
                  {formatGhs(data.accountSummary.rates.termly)}
                </span>
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {receiptOpen && receiptData ? (
        <ReceiptPrinter
          show={receiptOpen}
          receiptData={receiptData}
          onPrint={() => setReceiptOpen(false)}
          onClose={() => {
            setReceiptOpen(false);
            setReceiptData(null);
          }}
        />
      ) : null}
    </div>
  );
};

export default DailyFeeStudentReport;
