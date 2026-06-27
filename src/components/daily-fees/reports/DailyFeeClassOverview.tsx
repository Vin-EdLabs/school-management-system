import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Calendar, Coins, PieChart as PieChartIcon, Users } from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateFormat';
import {
  formatGhs,
  PAYMENT_TYPE_COLORS,
  type ClassOverviewReport,
  type DailyFeeCoverageStatus,
} from '@/services/dailyFeeReportsApi';

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
};

type SortKey = 'totalPaid' | 'lastPayment';

function statusBadge(status: DailyFeeCoverageStatus) {
  if (status === 'covered') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100">
        Covered
      </Badge>
    );
  }
  if (status === 'expired') {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
        Expired
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
      Never Paid
    </Badge>
  );
}

type Props = {
  data: ClassOverviewReport | null;
  loading: boolean;
  search: string;
  onSearchChange: (v: string) => void;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onViewStudent: (studentId: number) => void;
};

const DailyFeeClassOverview: React.FC<Props> = ({
  data,
  loading,
  search,
  onSearchChange,
  sortKey,
  sortDir,
  onSort,
  onViewStudent,
}) => {
  const chartData = useMemo(() => {
    if (!data) return [];
    return data.dailyCollections.map((row) => ({
      date: row.date,
      label: formatDisplayDate(row.date),
      daily: row.byType.daily,
      weekly: row.byType.weekly,
      monthly: row.byType.monthly,
      termly: row.byType.termly,
      total: row.total,
      studentCount: row.studentCount,
    }));
  }, [data]);

  const donutData = useMemo(() => {
    if (!data) return [];
    return data.paymentTypeBreakdown.map((row) => ({
      name: row.label,
      type: row.type,
      value: row.amount,
      count: row.count,
    }));
  }, [data]);

  const filteredStudents = useMemo(() => {
    if (!data) return [];
    let rows = [...data.students];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (s) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentCode.toLowerCase().includes(q) ||
          String(s.admissionNumber || '').toLowerCase().includes(q)
      );
    }
    rows.sort((a, b) => {
      if (sortKey === 'totalPaid') {
        return sortDir === 'asc' ? a.totalPaid - b.totalPaid : b.totalPaid - a.totalPaid;
      }
      const ad = a.lastPaymentDate || '';
      const bd = b.lastPaymentDate || '';
      return sortDir === 'asc' ? ad.localeCompare(bd) : bd.localeCompare(ad);
    });
    return rows;
  }, [data, search, sortKey, sortDir]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-2xl border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-slate-300" />
          <p className="text-lg font-medium text-slate-700">Select a class and term</p>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            Choose a daily fee class and term above to view collection reports.
          </p>
        </CardContent>
      </Card>
    );
  }

  const empty = data.summary.paymentCount === 0;

  if (empty) {
    return (
      <Card className="rounded-2xl border-dashed border-emerald-200 bg-emerald-50/30">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Coins className="mb-4 h-12 w-12 text-emerald-300" />
          <p className="text-lg font-medium text-slate-800">No payments recorded yet for this term</p>
          <p className="mt-1 max-w-md text-sm text-slate-600">
            Once payments are recorded for {data.class.name}, charts and student stats will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortIndicator = (key: SortKey) => (sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-2xl border-emerald-100 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Collected</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{formatGhs(data.summary.totalCollected)}</p>
                <p className="mt-1 text-xs text-slate-500">{data.summary.paymentCount} payments recorded</p>
              </div>
              <div className="rounded-xl bg-emerald-100 p-2.5">
                <Coins className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-sky-100 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Students Paying</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{data.summary.studentsPaying}</p>
                <p className="mt-1 text-xs text-slate-500">
                  out of {data.summary.totalStudents} total students in class
                </p>
              </div>
              <div className="rounded-xl bg-sky-100 p-2.5">
                <Users className="h-5 w-5 text-sky-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-violet-100 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Most Common Payment Type</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {data.summary.mostCommonPaymentType.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.summary.mostCommonPaymentType.count}{' '}
                  {data.summary.mostCommonPaymentType.type} payments
                </p>
              </div>
              <div className="rounded-xl bg-violet-100 p-2.5">
                <PieChartIcon className="h-5 w-5 text-violet-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-amber-100 shadow-sm">
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">Last Collection Date</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {data.summary.lastCollection
                    ? formatDisplayDate(data.summary.lastCollection.date)
                    : '—'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {data.summary.lastCollection ? `by ${data.summary.lastCollection.studentName}` : 'No payments yet'}
                </p>
              </div>
              <div className="rounded-xl bg-amber-100 p-2.5">
                <Calendar className="h-5 w-5 text-amber-700" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Daily Collections — {data.class.name} — {data.term.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={48} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, name: string) => [formatGhs(value), name]}
                    labelFormatter={(_, payload) => {
                      const row = payload?.[0]?.payload;
                      if (!row) return '';
                      return `${row.label} · ${row.studentCount} student(s) · Total ${formatGhs(row.total)}`;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="daily" stackId="a" fill={PAYMENT_TYPE_COLORS.daily} name="Daily" />
                  <Bar dataKey="weekly" stackId="a" fill={PAYMENT_TYPE_COLORS.weekly} name="Weekly" />
                  <Bar dataKey="monthly" stackId="a" fill={PAYMENT_TYPE_COLORS.monthly} name="Monthly" />
                  <Bar dataKey="termly" stackId="a" fill={PAYMENT_TYPE_COLORS.termly} name="Termly" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="value"
                    nameKey="name"
                    cx="40%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    animationDuration={600}
                  >
                    {donutData.map((entry) => (
                      <Cell key={entry.type} fill={PAYMENT_TYPE_COLORS[entry.type] || '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number, _name, item) => {
                      const row = item?.payload;
                      return [`${formatGhs(value)} (${row?.count ?? 0} payments)`, row?.name];
                    }}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Students in Class</CardTitle>
          <Input
            placeholder="Search students…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="max-w-xs rounded-xl"
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Name</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => onSort('totalPaid')}
                >
                  Total Paid{sortIndicator('totalPaid')}
                </TableHead>
                <TableHead>Payment Count</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => onSort('lastPayment')}
                >
                  Last Payment{sortIndicator('lastPayment')}
                </TableHead>
                <TableHead>Coverage Status</TableHead>
                <TableHead>Most Used Type</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((row) => (
                <TableRow key={row.studentId}>
                  <TableCell className="font-medium">{row.studentName}</TableCell>
                  <TableCell>{formatGhs(row.totalPaid)}</TableCell>
                  <TableCell>{row.paymentCount}</TableCell>
                  <TableCell>
                    {row.lastPaymentDate ? formatDisplayDate(row.lastPaymentDate) : '—'}
                  </TableCell>
                  <TableCell>{statusBadge(row.coverageStatus)}</TableCell>
                  <TableCell>{row.mostUsedTypeLabel || '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={() => onViewStudent(row.studentId)}
                    >
                      View Report
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default DailyFeeClassOverview;
