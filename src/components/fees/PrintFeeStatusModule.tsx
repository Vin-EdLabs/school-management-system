import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { Printer, FileText, Users, GraduationCap, Loader2, AlertCircle } from 'lucide-react';

/** One row from the fee status report (server-calculated). */
interface FeeStatusStudent {
  studentId: number;
  studentNumber: string;
  studentName: string;
  className: string;
  totalFeeExpected: number;
  totalPaid: number;
  balance: number;
  status: 'owing' | 'paid' | 'credit';
}

interface FeeStatusReport {
  academicPeriod: { term: string; academicYear: string; label: string };
  class: { id: number; name: string };
  students: FeeStatusStudent[];
  summary: { totalExpected: number; totalPaid: number; totalBalance: number; count: number };
}

type StatusFilter = 'all' | 'owing' | 'paid';

const PrintFeeStatusModule = () => {
  const { school, schoolId } = useSchool();
  const schoolName = school?.name ?? 'School';

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [report, setReport] = useState<FeeStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadClasses();
  }, [schoolId]);

  useEffect(() => {
    if (!selectedClassId) {
      setReport(null);
      setError(null);
      return;
    }
    loadReport();
  }, [selectedClassId, statusFilter]);

  const loadClasses = async () => {
    try {
      const res = await apiService.get<any[]>('/classes');
      const arr = Array.isArray(res) ? res : [];
      setClasses(arr.map((c: any) => ({ id: String(c.id), class_name: c.class_name || '' })));
    } catch {
      setClasses([]);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        classId: selectedClassId,
        status: statusFilter,
      });
      const res = await apiService.get<FeeStatusReport>(`/reports/fee-status?${params}`);
      setReport(res);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    const cls = classes.find((c) => c.id === classId);
    setSelectedClassName(cls?.class_name ?? '');
  };

  const studentsToShow = report?.students ?? [];
  const summary = report?.summary;
  const periodLabel = report?.academicPeriod?.label ?? 'Current period';

  const handlePrint = () => {
    if (!report || studentsToShow.length === 0 && !loading) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html><html><head><title>Fee Status Report</title></head>
          <body><p>No data to print. Select a class and ensure the report has loaded.</p></body></html>
        `);
        printWindow.document.close();
      }
      return;
    }

    const rows = studentsToShow
      .map(
        (s) => `
        <tr>
          <td>${s.studentNumber}</td>
          <td>${s.studentName}</td>
          <td>${s.className}</td>
          <td class="amount">GHS ${s.totalFeeExpected.toLocaleString()}</td>
          <td class="amount">GHS ${s.totalPaid.toLocaleString()}</td>
          <td class="amount ${s.balance > 0 ? 'owing' : s.balance < 0 ? 'credit' : ''}">GHS ${s.balance.toLocaleString()}</td>
          <td>${s.status === 'owing' ? 'Owing' : s.status === 'credit' ? 'Credit' : 'Paid'}</td>
        </tr>
      `
      )
      .join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Status Report - ${selectedClassName}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; color: #333; font-size: 14px; }
          .header { text-align: center; margin-bottom: 24px; border-bottom: 2px solid #3B82F6; padding-bottom: 16px; }
          .school-name { font-size: 22px; font-weight: bold; color: #1F2937; }
          .report-title { font-size: 16px; font-weight: bold; color: #3B82F6; margin-top: 8px; }
          .report-info { background: #F3F4F6; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #D1D5DB; padding: 10px; text-align: left; }
          th { background: #3B82F6; color: white; }
          tr:nth-child(even) { background: #F9FAFB; }
          .amount { text-align: right; }
          .amount.owing { color: #DC2626; font-weight: bold; }
          .amount.credit { color: #059669; }
          .summary { margin-top: 20px; padding: 12px 16px; background: #EFF6FF; border-radius: 8px; border-left: 4px solid #3B82F6; }
          .footer { margin-top: 32px; font-size: 12px; color: #6B7280; text-align: center; }
          @media print {
            body { margin: 12px; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="school-name">${schoolName}</div>
          <div class="report-title">Fee Status / Class Report</div>
        </div>
        <div class="report-info">
          <p><strong>Class:</strong> ${selectedClassName} &nbsp;|&nbsp; <strong>Academic Period:</strong> ${periodLabel}</p>
          <p><strong>Report Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Students:</strong> ${studentsToShow.length}
            ${summary != null ? ` &nbsp;|&nbsp; <strong>Total Balance:</strong> GHS ${summary.totalBalance.toLocaleString()}</p>` : '</p>'}
        </div>
        <table>
          <thead>
            <tr>
              <th>Student ID</th>
              <th>Student Name</th>
              <th>Class</th>
              <th>Total Fee Expected</th>
              <th>Total Amount Paid</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        ${summary != null ? `<div class="summary"><strong>Summary:</strong> Total Expected: GHS ${summary.totalExpected.toLocaleString()} &nbsp;|&nbsp; Total Paid: GHS ${summary.totalPaid.toLocaleString()} &nbsp;|&nbsp; Total Balance: GHS ${summary.totalBalance.toLocaleString()}</div>` : ''}
        <div class="footer">Generated by ${schoolName}</div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Printer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Fee Status / Class Report</h1>
            <p className="text-gray-600">All students in a class for the current academic period — calculations done server-side</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Current Academic Period</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            The report uses the <strong>current academic period</strong> from school settings. Select a class below to load the fee status for all students in that class.
          </p>
          {report?.academicPeriod && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Term</p>
                <p className="font-semibold">{report.academicPeriod.term}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Academic Year</p>
                <p className="font-semibold">{report.academicPeriod.academicYear}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <GraduationCap className="w-5 h-5" />
            <span>Select Class &amp; Filter</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class</label>
            <Select value={selectedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.class_name}
                  </SelectItem>
                ))}
                {classes.length === 0 && (
                  <SelectItem value="none" disabled>No classes found</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Show</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full bg-white max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Show All</SelectItem>
                <SelectItem value="owing">Show Only Owing Students</SelectItem>
                <SelectItem value="paid">Show Only Fully Paid Students</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-800 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {selectedClassId && report && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Report summary</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-blue-600">Class</p>
                  <p className="font-medium">{report.class.name}</p>
                </div>
                <div>
                  <p className="text-blue-600">Students</p>
                  <p className="font-medium">{report.summary.count}</p>
                </div>
                <div>
                  <p className="text-blue-600">Total balance</p>
                  <p className="font-medium text-red-600">GHS {report.summary.totalBalance.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClassId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>Students {statusFilter === 'owing' ? 'Owing' : statusFilter === 'paid' ? 'Fully Paid' : 'in Class'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : studentsToShow.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-3 font-medium">Student ID</th>
                      <th className="text-left p-3 font-medium">Student Name</th>
                      <th className="text-left p-3 font-medium">Class</th>
                      <th className="text-right p-3 font-medium">Total Fee Expected</th>
                      <th className="text-right p-3 font-medium">Total Paid</th>
                      <th className="text-right p-3 font-medium">Balance</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsToShow.map((s) => (
                      <tr key={s.studentId} className="border-b hover:bg-gray-50/50">
                        <td className="p-3">{s.studentNumber}</td>
                        <td className="p-3">{s.studentName}</td>
                        <td className="p-3">{s.className}</td>
                        <td className="p-3 text-right">GHS {s.totalFeeExpected.toLocaleString()}</td>
                        <td className="p-3 text-right text-green-600">GHS {s.totalPaid.toLocaleString()}</td>
                        <td className={`p-3 text-right font-medium ${s.balance > 0 ? 'text-red-600' : s.balance < 0 ? 'text-emerald-600' : ''}`}>
                          GHS {s.balance.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <Badge
                            variant={s.status === 'owing' ? 'destructive' : s.status === 'credit' ? 'secondary' : 'default'}
                            className={s.status === 'paid' ? 'bg-emerald-600' : ''}
                          >
                            {s.status === 'owing' ? 'Owing' : s.status === 'credit' ? 'Credit' : 'Paid'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">
                {report ? `No students ${statusFilter === 'owing' ? 'owing' : statusFilter === 'paid' ? 'fully paid' : ''} in this class.` : 'Select a class to load the report.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Button
              onClick={handlePrint}
              disabled={!selectedClassId || loading}
              size="lg"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              <Printer className="w-5 h-5 mr-2" />
              {loading ? 'Loading...' : 'Print Report'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintFeeStatusModule;
