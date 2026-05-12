import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { History, Wallet, TrendingDown, Banknote, PiggyBank } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import {
  type TeacherMySalaryResponse,
  TEACHER_SALARY_MONTHS,
  formatTeacherMoney,
  salaryStatusBadgeClass,
} from './teacherSalaryPortal';

const TeacherPaymentHistoryModule = () => {
  const { schoolId } = useSchool();
  const [salaryInfo, setSalaryInfo] = useState<TeacherMySalaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
  }, [schoolId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await apiService.get<TeacherMySalaryResponse>('/payroll/my-salary');
        setSalaryInfo(res);
      } catch {
        setError(true);
        setSalaryInfo(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [schoolId]);

  const cur = salaryInfo?.currency || 'GHS';
  const snap = salaryInfo?.currentMonthSnapshot;

  const totals = useMemo(() => {
    if (!salaryInfo?.paymentHistory?.length) {
      return { paidYtd: 0, netScheduled: 0 };
    }
    const y = new Date().getFullYear();
    const paidYtd = salaryInfo.paymentHistory.filter((p) => p.year === y).reduce((s, p) => s + p.amountPaid, 0);
    const netScheduled = salaryInfo.paymentHistory.filter((p) => p.year === y).reduce((s, p) => s + p.netSalary, 0);
    return { paidYtd, netScheduled };
  }, [salaryInfo]);

  if (loading) {
    return <div className="px-4 py-5 sm:p-6 animate-pulse text-slate-500">Loading payment history…</div>;
  }

  if (error || !salaryInfo) {
    return (
      <div className="px-4 py-5 sm:p-6">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Unable to load</h3>
            <p className="text-gray-500 dark:text-gray-400">Only teachers can view salary history. If you are a teacher, contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-5xl mx-auto w-full pb-10">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm">
          <History className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Salary & payments</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-0.5">Contract pay, deductions, and what was paid each month</p>
        </div>
      </div>

      {/* Contract + this month snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border-emerald-200/60 dark:border-emerald-900/40 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 dark:from-emerald-950/40 dark:to-teal-950/20 border-b border-emerald-100/80 dark:border-emerald-900/30">
            <CardTitle className="text-base flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <Wallet className="w-5 h-5 shrink-0" />
              Contract (annual basis)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Monthly gross</span>
              <span className="font-semibold font-mono tabular-nums text-right">{formatTeacherMoney(cur, salaryInfo.monthlySalary)}</span>
            </div>
            {salaryInfo.ssnitEnabled !== false && (
              <div className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">SSNIT ({salaryInfo.defaultSsnitPercent ?? 5.5}%)</span>
                <span className="font-mono tabular-nums text-amber-700 dark:text-amber-400 text-right">
                  −{formatTeacherMoney(cur, salaryInfo.ssnitDeduction)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between gap-3 items-baseline">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Typical net (before extras)</span>
              <span className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {formatTeacherMoney(cur, salaryInfo.netSalary)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="pb-2 border-b bg-muted/40">
            <CardTitle className="text-base flex items-center gap-2">
              <Banknote className="w-5 h-5 shrink-0" />
              This calendar month
            </CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              {TEACHER_SALARY_MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
            </p>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {snap && (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <span className="text-muted-foreground">Gross</span>
                  <span className="font-mono tabular-nums text-right font-medium">{formatTeacherMoney(cur, snap.grossSalary)}</span>
                  <span className="text-muted-foreground">SSNIT</span>
                  <span className="font-mono tabular-nums text-right text-amber-700 dark:text-amber-400">
                    −{formatTeacherMoney(cur, snap.ssnitAmount)}
                  </span>
                  <span className="text-muted-foreground">Net due</span>
                  <span className="font-mono tabular-nums text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    {formatTeacherMoney(cur, snap.netSalary)}
                  </span>
                  <span className="text-muted-foreground">Paid so far</span>
                  <span className="font-mono tabular-nums text-right">{formatTeacherMoney(cur, snap.amountPaid)}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge className={salaryStatusBadgeClass(snap.status)}>{snap.status}</Badge>
                </div>
                {snap.paidDate && (
                  <p className="text-xs text-muted-foreground">Last recorded: {new Date(snap.paidDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <PiggyBank className="w-4 h-4" />
            Paid this year
          </div>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">{formatTeacherMoney(cur, totals.paidYtd)}</p>
        </Card>
        <Card className="p-4 shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
            <TrendingDown className="w-4 h-4" />
            Net scheduled ({new Date().getFullYear()})
          </div>
          <p className="text-xl font-bold font-mono tabular-nums mt-1">{formatTeacherMoney(cur, totals.netScheduled)}</p>
        </Card>
        <Card className="p-4 shadow-sm sm:col-span-1 col-span-full">
          <div className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Current month</div>
          <p className="text-lg font-semibold mt-1">
            <Badge className={salaryStatusBadgeClass(salaryInfo.currentMonthStatus)}>{salaryInfo.currentMonthStatus}</Badge>
          </p>
        </Card>
      </div>

      <Card className="shadow-sm overflow-hidden border-slate-200 dark:border-slate-800">
        <CardHeader className="border-b bg-muted/30">
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="w-5 h-5" />
            Payment history
          </CardTitle>
          <p className="text-sm text-muted-foreground font-normal">Newest first. Amounts match the school payroll register.</p>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {salaryInfo.paymentHistory?.length > 0 ? (
            <>
              {/* Mobile: stacked cards */}
              <div className="sm:hidden divide-y divide-border">
                {salaryInfo.paymentHistory.map((p, i) => (
                  <div key={`${p.year}-${p.month}-${i}`} className="p-4 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-semibold">
                        {TEACHER_SALARY_MONTHS[p.month - 1]} {p.year}
                      </span>
                      <Badge className={salaryStatusBadgeClass(p.status)}>{p.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Gross</p>
                        <p className="font-mono tabular-nums">{formatTeacherMoney(cur, p.grossSalary)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">SSNIT</p>
                        <p className="font-mono tabular-nums text-amber-700 dark:text-amber-400">−{formatTeacherMoney(cur, p.ssnitAmount)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Net</p>
                        <p className="font-mono tabular-nums font-medium text-emerald-700 dark:text-emerald-400">{formatTeacherMoney(cur, p.netSalary)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Paid</p>
                        <p className="font-mono tabular-nums">{formatTeacherMoney(cur, p.amountPaid)}</p>
                      </div>
                    </div>
                    {p.balanceOwing > 0.01 && p.status !== 'Paid' && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">Balance: {formatTeacherMoney(cur, p.balanceOwing)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {p.paidDate ? new Date(p.paidDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                      {p.paymentMethod ? ` · ${p.paymentMethod}` : ''}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop / tablet */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="whitespace-nowrap font-semibold">Period</TableHead>
                      <TableHead className="text-right font-semibold whitespace-nowrap">Gross</TableHead>
                      <TableHead className="text-right font-semibold whitespace-nowrap">SSNIT</TableHead>
                      <TableHead className="text-right font-semibold whitespace-nowrap">Net</TableHead>
                      <TableHead className="text-right font-semibold whitespace-nowrap">Paid</TableHead>
                      <TableHead className="text-right font-semibold whitespace-nowrap hidden lg:table-cell">Balance</TableHead>
                      <TableHead className="whitespace-nowrap hidden md:table-cell">Method</TableHead>
                      <TableHead className="whitespace-nowrap">Paid date</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salaryInfo.paymentHistory.map((p, i) => (
                      <TableRow key={`${p.year}-${p.month}-${i}`} className="border-border">
                        <TableCell className="font-medium whitespace-nowrap">
                          {TEACHER_SALARY_MONTHS[p.month - 1]} {p.year}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatTeacherMoney(cur, p.grossSalary)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm text-amber-700 dark:text-amber-400">
                          −{formatTeacherMoney(cur, p.ssnitAmount)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm font-medium text-emerald-800 dark:text-emerald-300">
                          {formatTeacherMoney(cur, p.netSalary)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm">{formatTeacherMoney(cur, p.amountPaid)}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-sm hidden lg:table-cell">
                          {p.balanceOwing > 0.01 && p.status !== 'Paid' ? formatTeacherMoney(cur, p.balanceOwing) : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm hidden md:table-cell max-w-[120px] truncate">
                          {p.paymentMethod || '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {p.paidDate ? new Date(p.paidDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={salaryStatusBadgeClass(p.status)}>{p.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : (
            <div className="text-center py-14 px-4 text-muted-foreground">
              <Wallet className="w-14 h-14 mx-auto mb-4 opacity-40" />
              <p className="font-medium text-foreground">No payroll months on file yet</p>
              <p className="text-sm mt-1 max-w-sm mx-auto">When finance prepares payroll and records payment for a month, it will show here with gross, SSNIT, and net amounts.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherPaymentHistoryModule;
