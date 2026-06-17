import React, { useState, useEffect, useCallback } from 'react';
import { formatBalanceLines, type StudentBalance } from '../../services/studentBalance';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchool } from '../../contexts/SchoolContext';
import { useSocket } from '../../contexts/SocketContext';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import { formatDisplayDate } from '../../utils/dateFormat';
import { downloadFeeStatusPdf } from './buildFeeStatusPdf';
import { loadImageDataUrl } from '../../utils/schoolPdfHeader';
import { toast } from '@/hooks/use-toast';
import { Printer, FileText, Users, GraduationCap, Loader2, AlertCircle, RefreshCw, FileDown } from 'lucide-react';

/** One row from the fee status report (server-calculated). */
interface FeeStatusStudent {
  studentId: number;
  studentNumber: string;
  studentName: string;
  className: string;
  /** Current-term fee from Set Fees (after beneficiary discount). */
  termFee?: number;
  /** Arrears carried into this term (from term_arrears). */
  arrears?: number;
  /** termFee + arrears — amount due before payments. */
  totalFeeExpected: number;
  totalPaid: number;
  balance: number;
  status: 'owing' | 'paid' | 'credit' | 'not_set' | 'no_fee';
  liveBreakdown?: StudentBalance | null;
}

interface FeeStatusReport {
  academicPeriod: { term: string; academicYear: string; label: string };
  class: { id: number; name: string };
  students: FeeStatusStudent[];
  summary: {
    totalTermFee?: number;
    totalArrears?: number;
    totalExpected: number;
    totalPaid: number;
    totalBalance: number;
    count: number;
  };
}

type StatusFilter = 'all' | 'owing' | 'paid';

function feeStatusLabel(status: FeeStatusStudent['status']): string {
  if (status === 'owing') return 'Owing';
  if (status === 'credit') return 'Credit';
  if (status === 'not_set') return 'Not Set';
  if (status === 'no_fee') return 'No Fee Set';
  return 'Paid';
}

function statusFilterLabel(filter: StatusFilter): string {
  if (filter === 'owing') return 'Students owing fees';
  if (filter === 'paid') return 'Fully paid students';
  return 'All students';
}

const PrintFeeStatusModule = () => {
  const { school, schoolId } = useSchool();
  const { socket } = useSocket();
  const schoolName = school?.name ?? 'School';

  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedClassName, setSelectedClassName] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [report, setReport] = useState<FeeStatusReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classes, setClasses] = useState<{ id: string; class_name: string }[]>([]);
  const [expandedStudentIds, setExpandedStudentIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (schoolId != null) apiService.setTenantContext(schoolId);
    loadClasses();
  }, [schoolId]);

  const loadReport = useCallback(async () => {
    if (!selectedClassId) {
      setReport(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        classId: selectedClassId,
        status: statusFilter,
        _t: String(Date.now()),
      });
      const res = await apiService.get<FeeStatusReport>(`/reports/fee-status?${params}`);
      setReport(res);
    } catch (err: any) {
      setReport(null);
      setError(err?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [selectedClassId, statusFilter]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const loadClasses = async () => {
    try {
      const res = await apiService.get<any[]>('/classes');
      const arr = Array.isArray(res) ? res : [];
      setClasses(arr.map((c: any) => ({ id: String(c.id), class_name: c.class_name || '' })));
    } catch {
      setClasses([]);
    }
  };

  useEffect(() => {
    if (!socket || !selectedClassId) return;
    const onTenantDataChanged = (evt: { entity?: string } | undefined) => {
      const e = evt?.entity || '';
      if (e === 'fee' || e === 'finance-arrears' || e === 'payment') {
        loadReport();
      }
    };
    socket.on('tenant-data-changed', onTenantDataChanged);
    return () => {
      socket.off('tenant-data-changed', onTenantDataChanged);
    };
  }, [socket, selectedClassId, loadReport]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && selectedClassId) loadReport();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [selectedClassId, loadReport]);

  const toggleExpanded = (studentId: number) => {
    setExpandedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const handleClassChange = (classId: string) => {
    setSelectedClassId(classId);
    setExpandedStudentIds(new Set());
    const cls = classes.find((c) => c.id === classId);
    setSelectedClassName(cls?.class_name ?? '');
  };

  const studentsToShow = report?.students ?? [];
  const summary = report?.summary;
  const periodLabel = report?.academicPeriod?.label ?? 'Current period';

  const logoUrl = resolveLogoUrl(school?.logo_url ?? null);

  const handleExportPdf = async () => {
    if (!report || studentsToShow.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'Select a class and load the report first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await downloadFeeStatusPdf({
        schoolName,
        logoUrl,
        className: selectedClassName || report.class.name,
        periodLabel,
        term: report.academicPeriod.term,
        academicYear: report.academicPeriod.academicYear,
        statusFilterLabel: statusFilterLabel(statusFilter),
        students: studentsToShow,
        summary: report.summary,
      });
      toast({
        title: 'PDF export ready',
        description: `${studentsToShow.length} student(s) exported to PDF.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Export failed',
        description: err instanceof Error ? err.message : 'Could not generate PDF.',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = async () => {
    if (!report || (studentsToShow.length === 0 && !loading)) {
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

    const logoDataUrl = await loadImageDataUrl(logoUrl);

    const money = (n: number) =>
      Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const rows = studentsToShow
      .map(
        (s, index) => `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${s.studentNumber}</td>
          <td>${s.studentName}</td>
          <td class="amount">GHS ${money(s.termFee ?? 0)}</td>
          <td class="amount">GHS ${money(s.arrears ?? 0)}</td>
          <td class="amount">GHS ${money(s.totalFeeExpected ?? 0)}</td>
          <td class="amount">GHS ${money(s.totalPaid)}</td>
          <td class="amount ${s.balance > 0 ? 'owing' : s.balance < 0 ? 'credit' : ''}">GHS ${money(s.balance)}</td>
          <td class="center status-${s.status}">${feeStatusLabel(s.status)}</td>
        </tr>
      `
      )
      .join('');

    const logoBlock = logoDataUrl
      ? `<img src="${logoDataUrl}" alt="" class="logo" />`
      : '';

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fee Status Report - ${selectedClassName}</title>
        <style>
          @page { size: A4 landscape; margin: 14mm; }
          body { font-family: "Times New Roman", Times, serif; margin: 0; color: #222; font-size: 11pt; }
          .header { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid #2d2d2d; }
          .logo { width: 64px; height: 64px; object-fit: contain; flex-shrink: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .school-name { font-size: 18pt; font-weight: bold; margin: 0 0 4px; }
          .report-title { font-size: 11pt; margin: 0; color: #444; }
          .meta { font-size: 9pt; color: #444; line-height: 1.55; margin-bottom: 16px; }
          .summary-table { width: 280px; border-collapse: collapse; margin-bottom: 18px; font-size: 9.5pt; }
          .summary-table th, .summary-table td { border: 1px solid #b4b4b4; padding: 6px 8px; }
          .summary-table th { background: #f2f2f2; text-align: left; font-weight: bold; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .summary-table td:last-child { text-align: right; }
          table.data { width: 100%; border-collapse: collapse; font-size: 9pt; }
          table.data th, table.data td { border: 1px solid #b4b4b4; padding: 6px 7px; }
          table.data th { background: #f2f2f2; font-weight: bold; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table.data tbody tr:nth-child(even) { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .amount { text-align: right; }
          .center { text-align: center; }
          .amount.owing, .status-owing { color: #b91c1c; font-weight: bold; }
          .amount.credit, .status-credit { color: #059669; font-weight: bold; }
          .status-paid { color: #166534; }
          .footer { margin-top: 24px; font-size: 8pt; color: #777; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoBlock}
          <div>
            <p class="school-name">${schoolName}</p>
            <p class="report-title">Fee status report</p>
          </div>
        </div>
        <div class="meta">
          <div><strong>Class:</strong> ${selectedClassName}</div>
          <div><strong>Academic period:</strong> ${periodLabel}</div>
          <div><strong>Filter:</strong> ${statusFilterLabel(statusFilter)} &nbsp;·&nbsp; <strong>Report date:</strong> ${formatDisplayDate(new Date())}</div>
          <div><strong>Students listed:</strong> ${studentsToShow.length}</div>
        </div>
        ${
          summary != null
            ? `<table class="summary-table">
          <thead><tr><th>Summary</th><th>Amount (GHS)</th></tr></thead>
          <tbody>
            <tr><td>Total term bills</td><td>${money(summary.totalTermFee ?? 0)}</td></tr>
            <tr><td>Total arrears</td><td>${money(summary.totalArrears ?? 0)}</td></tr>
            <tr><td>Total due</td><td>${money(summary.totalExpected)}</td></tr>
            <tr><td>Total paid</td><td>${money(summary.totalPaid)}</td></tr>
            <tr><td>Outstanding balance</td><td>${money(Math.max(0, summary.totalBalance))}</td></tr>
          </tbody>
        </table>`
            : ''
        }
        <table class="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Student ID</th>
              <th>Student name</th>
              <th>Total term bill</th>
              <th>Arrears</th>
              <th>Total due</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">
          <span>${schoolName} — Fee status report</span>
          <span>Generated ${new Date().toLocaleString()}</span>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(printContent);
    printWindow.document.close();

    const waitForImages = () =>
      Promise.all(
        Array.from(printWindow.document.images).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

    await waitForImages();
    printWindow.focus();
    printWindow.print();
    setTimeout(() => printWindow.close(), 300);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
            <Printer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fee Status / Class Report</h1>
            <p className="text-muted-foreground">All students in a class for the current academic period — calculations done server-side</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!selectedClassId || loading}
          onClick={() => loadReport()}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh report
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Current Academic Period</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The report uses the <strong>current academic period</strong> from school settings. <strong>Total Term Bill</strong> comes from Set Fees; <strong>arrears</strong> from carried balances; <strong>total due</strong> = total term bill + arrears; <strong>balance</strong> = total due − paid.
          </p>
          {report?.academicPeriod && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Term</p>
                <p className="font-semibold text-foreground">{report.academicPeriod.term}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Academic Year</p>
                <p className="font-semibold text-foreground">{report.academicPeriod.academicYear}</p>
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
            <label className="block text-sm font-medium text-muted-foreground mb-2">Class</label>
            <Select value={selectedClassId} onValueChange={handleClassChange}>
              <SelectTrigger className="w-full bg-background border-border">
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
            <label className="block text-sm font-medium text-muted-foreground mb-2">Show</label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-full bg-background border-border max-w-xs">
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
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {selectedClassId && report && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <h3 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">Report summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Class</p>
                  <p className="font-medium text-foreground">{report.class.name}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Students</p>
                  <p className="font-medium text-foreground">{report.summary.count}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Total term bills</p>
                  <p className="font-medium text-foreground">GHS {(report.summary.totalTermFee ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Arrears</p>
                  <p className="font-medium text-amber-700 dark:text-amber-400">GHS {(report.summary.totalArrears ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Total due</p>
                  <p className="font-medium text-foreground">GHS {report.summary.totalExpected.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-blue-600/80 dark:text-blue-400/80">Paid / Balance</p>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">GHS {report.summary.totalPaid.toLocaleString()}</p>
                  <p className={`font-medium ${report.summary.totalBalance > 0 ? 'text-red-600 dark:text-red-400' : report.summary.totalBalance < 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                    Bal: GHS {report.summary.totalBalance.toLocaleString()}
                  </p>
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
              <>
              <p className="text-xs text-muted-foreground mb-3 records-no-print">Click a student row to expand the live fee line breakdown.</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left p-3 font-medium text-foreground">Student ID</th>
                      <th className="text-left p-3 font-medium text-foreground">Student Name</th>
                      <th className="text-left p-3 font-medium text-foreground">Class</th>
                      <th className="text-right p-3 font-medium text-foreground">Total Term Bill</th>
                      <th className="text-right p-3 font-medium text-foreground">Arrears</th>
                      <th className="text-right p-3 font-medium text-foreground">Total due</th>
                      <th className="text-right p-3 font-medium text-foreground">Paid</th>
                      <th className="text-right p-3 font-medium text-foreground">Balance</th>
                      <th className="text-left p-3 font-medium text-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsToShow.map((s) => {
                      const expanded = expandedStudentIds.has(s.studentId);
                      const detailLines = s.liveBreakdown ? formatBalanceLines(s.liveBreakdown) : null;
                      return (
                        <React.Fragment key={s.studentId}>
                          <tr
                            className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer"
                            onClick={() => toggleExpanded(s.studentId)}
                          >
                            <td className="p-3 text-foreground">{s.studentNumber}</td>
                            <td className="p-3 text-foreground">{s.studentName}</td>
                            <td className="p-3 text-foreground">{s.className}</td>
                            <td className="p-3 text-right text-foreground">GHS {(s.termFee ?? 0).toLocaleString()}</td>
                            <td className="p-3 text-right text-amber-700 dark:text-amber-400">GHS {(s.arrears ?? 0).toLocaleString()}</td>
                            <td className="p-3 text-right font-medium text-foreground">GHS {(s.totalFeeExpected ?? 0).toLocaleString()}</td>
                            <td className="p-3 text-right text-emerald-600 dark:text-emerald-400">GHS {s.totalPaid.toLocaleString()}</td>
                            <td className={`p-3 text-right font-medium ${s.balance > 0 ? 'text-red-600 dark:text-red-400' : s.balance < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                              GHS {s.balance.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  s.status === 'owing'
                                    ? 'destructive'
                                    : s.status === 'credit'
                                      ? 'secondary'
                                      : s.status === 'not_set' || s.status === 'no_fee'
                                        ? 'outline'
                                        : 'default'
                                }
                                className={s.status === 'paid' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                              >
                                {feeStatusLabel(s.status)}
                              </Badge>
                            </td>
                          </tr>
                          {expanded && detailLines ? (
                            <tr className="border-b border-border bg-muted/20">
                              <td colSpan={9} className="p-4">
                                <div className="max-w-xl font-mono text-sm space-y-1">
                                  {detailLines.map((line, i) => (
                                    <div key={`${s.studentId}-${line.label}-${i}`} className={`flex justify-between gap-4 ${line.kind === 'total' || line.kind === 'outstanding' ? 'border-t pt-1 mt-1 font-semibold' : ''}`}>
                                      <span>{line.label}</span>
                                      <span>{line.kind === 'paid' ? '− ' : ''}GHS {Math.abs(line.amount).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                {report ? `No students ${statusFilter === 'owing' ? 'owing' : statusFilter === 'paid' ? 'fully paid' : ''} in this class.` : 'Select a class to load the report.'}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              onClick={() => void handleExportPdf()}
              disabled={!selectedClassId || loading || studentsToShow.length === 0}
              size="lg"
              variant="outline"
              className="min-w-[180px] border-slate-300"
            >
              <FileDown className="w-5 h-5 mr-2" />
              {loading ? 'Loading...' : 'Export PDF'}
            </Button>
            <Button
              onClick={() => void handlePrint()}
              disabled={!selectedClassId || loading || studentsToShow.length === 0}
              size="lg"
              className="min-w-[180px] bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700"
            >
              <Printer className="w-5 h-5 mr-2" />
              {loading ? 'Loading...' : 'Print Report'}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            PDF export uses your school logo and a clean classic layout — same style as the discount student report.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintFeeStatusModule;
