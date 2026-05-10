import React, { useState, useEffect } from 'react';
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
import { History, Wallet } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';

interface SalaryInfo {
  fullName: string;
  staffId: string;
  monthlySalary: number;
  currentMonthStatus: string;
  paymentHistory: { month: number; year: number; amount: number; paidDate: string; status: string }[];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const TeacherPaymentHistoryModule = () => {
  const { schoolId } = useSchool();
  const [salaryInfo, setSalaryInfo] = useState<SalaryInfo | null>(null);
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
        const res = await apiService.get<SalaryInfo>('/payroll/my-salary');
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

  if (loading) {
    return <div className="px-4 py-5 sm:p-6 animate-pulse text-slate-500">Loading payment history...</div>;
  }

  if (error || !salaryInfo) {
    return (
      <div className="px-4 py-5 sm:p-6">
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <History className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load</h3>
            <p className="text-gray-500">Only teachers can view salary payment history. If you are a teacher, please contact the administrator.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-4xl mx-auto w-full">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
          <History className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Payment History</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">Your salary payments over time</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5" />
            Salary Summary
          </CardTitle>
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">
            Monthly: <strong>GHS {salaryInfo.monthlySalary.toLocaleString()}</strong>
            <span className="hidden sm:inline"> — </span>
            <span className="sm:hidden"><br /></span>
            Current month: <Badge variant={salaryInfo.currentMonthStatus === 'Paid' ? 'default' : 'secondary'} className="ml-1 align-middle">{salaryInfo.currentMonthStatus}</Badge>
          </p>
        </CardHeader>
        <CardContent>
          {salaryInfo.paymentHistory?.length > 0 ? (
            <div className="rounded-lg border overflow-x-auto -mx-1 sm:mx-0 touch-pan-x">
              <Table className="min-w-[520px] sm:min-w-0">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="font-medium">Month / Year</TableHead>
                    <TableHead className="font-medium">Amount Paid</TableHead>
                    <TableHead className="font-medium">Date Paid</TableHead>
                    <TableHead className="font-medium">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salaryInfo.paymentHistory.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{MONTHS[p.month - 1]} {p.year}</TableCell>
                      <TableCell className="font-mono text-emerald-600">GHS {p.amount.toLocaleString()}</TableCell>
                      <TableCell>{p.paidDate ? new Date(p.paidDate).toLocaleDateString() : '—'}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'Paid' ? 'default' : 'secondary'} className={p.status === 'Paid' ? 'bg-emerald-600' : ''}>
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <Wallet className="w-14 h-14 mx-auto mb-4 text-slate-300" />
              <p className="font-medium">No salary payments recorded yet</p>
              <p className="text-sm mt-1">Payments will appear here when processed by administration.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeacherPaymentHistoryModule;
