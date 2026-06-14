import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import { resolveLogoUrl } from '../../services/tenantService';
import { cn } from '@/lib/utils';
import { Search, User, FileText, DollarSign, Award, UserCheck, History, Printer, FileDown, FileSpreadsheet, Receipt } from 'lucide-react';
import { formatBalanceLines, type StudentBalance } from '../../services/studentBalance';

type ProfileType = 'student' | 'teacher' | 'staff' | null;

const RecordsModule = () => {
  const { schoolId } = useSchool();
  const [searchId, setSearchId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: ProfileType; profile: any } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!searchId.trim()) {
      toast({ title: 'Enter an ID', description: 'Student ID, Teacher ID, or Staff ID', variant: 'destructive' });
      return;
    }
    if (schoolId == null) {
      toast({ title: 'Select a school', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      apiService.setTenantContext(schoolId);
      const res = await apiService.get<{ type: ProfileType; profile: any }>(
        `/records/profile-lookup?id=${encodeURIComponent(searchId.trim())}`
      );
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'No record found');
      toast({ title: 'Not found', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    window.print();
    toast({ title: 'Print', description: 'Choose "Save as PDF" in the print dialog' });
  };

  const handleExportExcel = () => {
    if (!result?.profile) return;
    const rows: string[][] = [];
    if (result.type === 'student') {
      const p = result.profile;
      rows.push(['Student Profile', '']);
      rows.push(['Full Name', p.header?.fullName]);
      rows.push(['Student ID', p.header?.studentId]);
      rows.push(['Class', p.header?.class]);
      rows.push(['', '']);
      rows.push(['Fees Summary', '']);
      rows.push(['Academic Year', 'Term', 'Term Fees', 'Arrears', 'Amount Due', 'Total Paid', 'Outstanding', 'Status']);
      (p.fees?.summaryByTerm || []).forEach((r: any) => {
        rows.push([
          r.academicYear,
          r.term,
          String(r.totalFees),
          String(r.arrears ?? 0),
          String(r.amountDue ?? (r.totalFees ?? 0) + (r.arrears ?? 0)),
          String(r.totalPaid),
          String(r.outstanding),
          r.status,
        ]);
      });
      rows.push(['', '']);
      rows.push(['All Receipts', '']);
      rows.push(['Date', 'Receipt No.', 'Term', 'Academic Year', 'Amount', 'Method', 'Recorded By', 'Status']);
      (p.fees?.receipts || p.fees?.paymentHistory || []).forEach((r: any) => {
        rows.push([
          r.date,
          r.receiptNumber || '',
          r.term || '',
          r.academicYear || '',
          String(r.amount),
          r.paymentMethod || '',
          r.recordedBy || '',
          r.voided ? 'Voided' : 'Active',
        ]);
      });
      rows.push(['', '']);
      rows.push(['Current Term Outstanding', String(Math.max(0, p.overview?.currentTermOutstanding ?? p.overview?.totalOutstanding ?? 0))]);
    } else if (result.type === 'teacher' || result.type === 'staff') {
      const p = result.profile;
      rows.push(['Profile', '']);
      rows.push(['Full Name', p.header?.fullName]);
      rows.push(['Staff ID', p.header?.staffId]);
      rows.push(['Role', p.header?.role]);
      rows.push(['', '']);
      rows.push(['Salary Payments', '']);
      rows.push(['Month', 'Year', 'Salary', 'Paid', 'Balance', 'Status']);
      (p.salaryPayments || []).forEach((r: any) => {
        rows.push([String(r.month), String(r.year), String(r.salaryAmount), String(r.paidAmount), String(r.balance), r.status]);
      });
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profile-${result.type}-${result.profile?.header?.studentId || result.profile?.header?.staffId || 'export'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: 'Exported', description: 'Data exported as CSV (open in Excel)' });
  };

  return (
    <div className="p-6 space-y-6 print:p-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Profile Lookup</h1>
          <p className="text-slate-600">Search by Student ID, Teacher ID, or Staff ID</p>
        </div>
      </div>

      <Card className="records-no-print">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Enter Student ID, Teacher ID, or Staff ID..."
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="bg-slate-800 hover:bg-slate-700">
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <p className="text-amber-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {result?.type === 'student' && result.profile && (
        <StudentProfileView profile={result.profile} onPrint={handlePrint} onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
      )}

      {(result?.type === 'teacher' || result?.type === 'staff') && result.profile && (
        <TeacherStaffProfileView profile={result.profile} onPrint={handlePrint} onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
      )}
    </div>
  );
};

function RecordsProfilePhoto({
  entityType,
  entityId,
  fullName = '',
  firstName = '',
  lastName = '',
  hasPassportPhoto,
  photoUrl,
  className,
}: {
  entityType: 'student' | 'teacher';
  entityId: number | string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  hasPassportPhoto?: boolean;
  photoUrl?: string | null;
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [loadedUrl, setLoadedUrl] = useState<string | undefined>(
    photoUrl?.startsWith('data:') || photoUrl?.startsWith('http') ? photoUrl : undefined
  );

  useEffect(() => {
    if (loadedUrl) return;
    if (!hasPassportPhoto && !photoUrl) return;
    let cancelled = false;
    void (async () => {
      try {
        const endpoint =
          entityType === 'student' ? `/students/${entityId}/photo` : `/teachers/${entityId}/photo`;
        const res = await apiService.get<{ passport_photo_url?: string }>(endpoint);
        if (!cancelled && res.passport_photo_url) setLoadedUrl(res.passport_photo_url);
      } catch {
        /* initials fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadedUrl, hasPassportPhoto, photoUrl, entityId, entityType]);

  const initials =
    entityType === 'student'
      ? `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || 'S'
      : fullName
          .trim()
          .split(/\s+/)
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() || 'T';
  const resolvedSrc = loadedUrl ? resolveLogoUrl(loadedUrl) || undefined : undefined;

  return (
    <span ref={rootRef} className={cn('inline-flex records-profile-photo', className)}>
      <Avatar className="h-24 w-24 rounded-xl border-2 border-white shadow">
        {resolvedSrc ? <AvatarImage src={resolvedSrc} alt="" className="object-cover" /> : null}
        <AvatarFallback className="rounded-xl bg-slate-200 text-slate-600 text-2xl">{initials}</AvatarFallback>
      </Avatar>
    </span>
  );
}

function LedgerBalanceTable({ breakdown }: { breakdown: StudentBalance | null | undefined }) {
  if (!breakdown) {
    return <p className="text-sm text-slate-500">No ledger balance available.</p>;
  }
  const lines = formatBalanceLines(breakdown);
  return (
    <div className="rounded-lg border bg-slate-50/80 p-4 font-mono text-sm">
      {lines.map((line, i) => (
        <div
          key={`${line.label}-${i}`}
          className={`flex justify-between gap-4 py-1 ${
            line.kind === 'total' || line.kind === 'outstanding'
              ? 'border-t border-slate-300 mt-2 pt-2 font-semibold'
              : line.kind === 'paid'
                ? 'text-emerald-700'
                : ''
          }`}
        >
          <span className={line.kind === 'outstanding' ? 'text-amber-800' : 'text-slate-700'}>{line.label}</span>
          <span className="tabular-nums whitespace-nowrap">
            {line.kind === 'paid' ? '− ' : ''}GHS {Math.abs(line.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </span>
        </div>
      ))}
      {breakdown.credit > 0 ? (
        <div className="flex justify-between gap-4 py-1 mt-2 text-blue-700 border-t border-slate-200 pt-2">
          <span>Credit balance</span>
          <span className="tabular-nums">GHS {breakdown.credit.toLocaleString()}</span>
        </div>
      ) : null}
    </div>
  );
}

function StudentProfileView({ profile, onPrint, onExportPDF, onExportExcel }: { profile: any; onPrint: () => void; onExportPDF: () => void; onExportExcel: () => void }) {
  const school = profile.school || {};
  const h = profile.header || {};
  const d = profile.details || {};
  const ov = profile.overview || {};
  const balance = profile.balance || null;
  const fees = profile.fees || {};
  const ledgerBalance: StudentBalance | null = fees.balance ?? fees.liveBreakdown ?? null;
  const acad = profile.academicPerformance || {};
  const att = profile.attendance || {};
  const activity = profile.activityLog || [];
  const receipts = fees.receipts || fees.paymentHistory || [];
  const printDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div id="printable-profile" className="space-y-6">
      <div className="records-print-header">
        <h1 className="text-xl font-bold text-slate-900">{school.name || 'School'} — Student Full Report</h1>
        <p className="text-sm text-slate-600 mt-1">
          {h.fullName} · ID: {h.studentId} · Class: {h.class}
          {school.currentTerm ? ` · ${school.currentTerm}${school.currentYear ? ` ${school.currentYear}` : ''}` : ''}
        </p>
        <p className="text-xs text-slate-500 mt-1">Generated on {printDate}</p>
      </div>

      <div className="flex justify-end gap-2 records-no-print">
        <Button variant="outline" size="sm" onClick={onPrint}>
          <Printer className="h-4 w-4 mr-1" /> Print
        </Button>
        <Button variant="outline" size="sm" onClick={onExportPDF}>
          <FileDown className="h-4 w-4 mr-1" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}>
          <FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel
        </Button>
      </div>

      <Card className="overflow-hidden records-print-card">
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
            <RecordsProfilePhoto
              entityType="student"
              entityId={h.id}
              fullName={h.fullName}
              firstName={h.firstName}
              lastName={h.lastName}
              hasPassportPhoto={h.hasPassportPhoto}
              photoUrl={h.passportPhotoUrl}
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{h.fullName}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">ID: {h.studentId}</Badge>
                <Badge variant="secondary">{h.class}</Badge>
                <Badge className={h.status === 'Suspended' ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}>
                  {h.status}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-slate-600">
                <p><span className="font-medium">Gender:</span> {h.gender || d.gender || '—'}</p>
                <p><span className="font-medium">Date of birth:</span> {h.dateOfBirth || d.dateOfBirth || '—'}</p>
                <p><span className="font-medium">Nationality:</span> {h.nationality || d.nationality || '—'}</p>
                <p><span className="font-medium">Admission:</span> {h.admissionDate}</p>
                <p><span className="font-medium">Parent / guardian:</span> {h.guardianName || d.guardianName} — {h.guardianContact || d.guardianContact}</p>
                <p className="sm:col-span-2"><span className="font-medium">Home address:</span> {h.homeAddress || d.homeAddress || '—'}</p>
                {h.isBeneficiary ? (
                  <p className="sm:col-span-2">
                    <span className="font-medium">Fee discount:</span>{' '}
                    {h.discountType
                      ? `${h.discountType}${h.discountValue != null ? ` (${h.discountValue}${String(h.discountType).toLowerCase() === 'percentage' ? '%' : ''})` : ''}`
                      : 'Full waiver (beneficiary)'}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-100 records-tab-list">
          <TabsTrigger value="overview"><User className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="details"><FileText className="h-4 w-4 mr-1" /> Student Details</TabsTrigger>
          <TabsTrigger value="fees"><DollarSign className="h-4 w-4 mr-1" /> Fees</TabsTrigger>
          <TabsTrigger value="receipts"><Receipt className="h-4 w-4 mr-1" /> Receipts</TabsTrigger>
          <TabsTrigger value="academic"><Award className="h-4 w-4 mr-1" /> Academic</TabsTrigger>
          <TabsTrigger value="attendance"><UserCheck className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="activity"><History className="h-4 w-4 mr-1" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 records-tab-panel" data-print-label="Overview">
          {ov.currentTermLabel ? (
            <Card className="records-print-card border-amber-200 bg-amber-50/50">
              <CardContent className="pt-4">
                <p className="text-sm font-medium text-slate-700">
                  Current term ({ov.currentTermLabel}) balance
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                  <div>
                    <p className="text-xs text-slate-500">Term fees</p>
                    <p className="text-lg font-bold">GHS {(balance?.termFees ?? ov.currentTermFees ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Arrears</p>
                    <p className="text-lg font-bold">GHS {(balance?.arrears ?? ov.currentTermArrears ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Amount due</p>
                    <p className="text-lg font-bold">GHS {(balance?.amountDue ?? ov.currentTermAmountDue ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Paid this term</p>
                    <p className="text-lg font-bold text-emerald-600">GHS {(balance?.totalPaid ?? ov.currentTermPaid ?? 0).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="text-lg font-bold text-amber-700">
                      GHS {Math.max(0, balance?.outstanding ?? ov.currentTermOutstanding ?? ov.totalOutstanding ?? 0).toLocaleString()}
                    </p>
                    {(balance?.status || ov.currentTermStatus) ? (
                      <Badge className="mt-1" variant={(balance?.status || ov.currentTermStatus) === 'Owing' ? 'destructive' : 'default'}>
                        {balance?.status || ov.currentTermStatus}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Term Fees (current)</p><p className="text-xl font-bold">GHS {(balance?.termFees ?? ov.currentTermFees ?? 0).toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Paid</p><p className="text-xl font-bold text-emerald-600">GHS {ov.totalPaid?.toLocaleString() || 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Outstanding</p><p className="text-xl font-bold text-amber-600">GHS {Math.max(0, balance?.outstanding ?? ov.currentTermOutstanding ?? ov.totalOutstanding ?? 0).toLocaleString()}</p></CardContent></Card>
            {(ov.creditBalance ?? 0) > 0 ? (
              <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Credit Balance</p><p className="text-xl font-bold text-emerald-700">GHS {ov.creditBalance?.toLocaleString() || 0}</p></CardContent></Card>
            ) : null}
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Term Average</p><p className="text-xl font-bold">{(ov.currentTermAverage || 0)}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Attendance</p><p className="text-xl font-bold">{ov.attendancePercentage ?? 0}%</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4 records-tab-panel" data-print-label="Student Details">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="records-print-card">
              <CardHeader><CardTitle>Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">First name</p><p className="font-medium">{h.firstName}</p></div>
                <div><p className="text-slate-500">Last name</p><p className="font-medium">{h.lastName}</p></div>
                <div><p className="text-slate-500">Gender</p><p className="font-medium">{d.gender || h.gender || '—'}</p></div>
                <div><p className="text-slate-500">Date of birth</p><p className="font-medium">{d.dateOfBirth || h.dateOfBirth || '—'}</p></div>
                <div><p className="text-slate-500">Nationality</p><p className="font-medium">{d.nationality || h.nationality || '—'}</p></div>
                <div><p className="text-slate-500">Home address</p><p className="font-medium">{d.homeAddress || h.homeAddress || '—'}</p></div>
              </CardContent>
            </Card>
            <Card className="records-print-card">
              <CardHeader><CardTitle>Academic Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-slate-500">Student ID</p><p className="font-medium">{h.studentId}</p></div>
                <div><p className="text-slate-500">Admission number</p><p className="font-medium">{h.admissionNumber || '—'}</p></div>
                <div><p className="text-slate-500">Class</p><p className="font-medium">{h.class}</p></div>
                <div><p className="text-slate-500">Level / stream</p><p className="font-medium">{[h.level, h.stream].filter(Boolean).join(' · ') || '—'}</p></div>
                <div><p className="text-slate-500">Date of admission</p><p className="font-medium">{h.admissionDate}</p></div>
                <div><p className="text-slate-500">Previous school</p><p className="font-medium">{d.previousSchool || '—'}</p></div>
                <div><p className="text-slate-500">Enrollment status</p><p className="font-medium capitalize">{d.enrollmentStatus || '—'}</p></div>
              </CardContent>
            </Card>
          </div>
          <Card className="records-print-card">
            <CardHeader><CardTitle>Parent / Guardian Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">Primary guardian name</p><p className="font-medium">{d.guardianName || h.guardianName}</p></div>
              <div><p className="text-slate-500">Primary contact</p><p className="font-medium font-mono">{d.guardianContact || h.guardianContact}</p></div>
              {(d.guardian2Name && d.guardian2Name !== '—') || (d.guardian2Contact && d.guardian2Contact !== '—') ? (
                <>
                  <div><p className="text-slate-500">Second guardian</p><p className="font-medium">{d.guardian2Name || '—'}{d.guardian2Relationship && d.guardian2Relationship !== '—' ? ` (${d.guardian2Relationship})` : ''}</p></div>
                  <div><p className="text-slate-500">Second contact</p><p className="font-medium font-mono">{d.guardian2Contact || '—'}</p></div>
                </>
              ) : null}
            </CardContent>
          </Card>
          <Card className="records-print-card">
            <CardHeader><CardTitle>Family & Notes</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500">Number of siblings</p><p className="font-medium">{d.numberOfSiblings ?? 0}</p></div>
              <div><p className="text-slate-500">Names of siblings</p><p className="font-medium">{d.namesOfSiblings || '—'}</p></div>
              {h.isBeneficiary ? (
                <>
                  <div><p className="text-slate-500">Beneficiary type</p><p className="font-medium">{d.beneficiaryType || h.discountType || 'Beneficiary'}</p></div>
                  <div><p className="text-slate-500">Beneficiary notes</p><p className="font-medium">{d.beneficiaryNotes || '—'}</p></div>
                </>
              ) : null}
              <div className="md:col-span-2"><p className="text-slate-500">Notes</p><p className="font-medium">{d.notes || '—'}</p></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6 records-tab-panel" data-print-label="Fees & Balances">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Ledger Fee Breakdown</CardTitle></CardHeader>
            <CardContent>
              <LedgerBalanceTable breakdown={ledgerBalance} />
            </CardContent>
          </Card>
          <Card className="records-print-card">
            <CardHeader><CardTitle>Summary Columns</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><p className="text-slate-500">Term fee</p><p className="text-lg font-bold">GHS {(ledgerBalance?.currentTermFee ?? balance?.termFees ?? 0).toLocaleString()}</p></div>
                <div><p className="text-slate-500">Arrears</p><p className="text-lg font-bold text-amber-700">GHS {(ledgerBalance?.totalArrears ?? balance?.arrears ?? 0).toLocaleString()}</p></div>
                <div><p className="text-slate-500">Total due</p><p className="text-lg font-bold">GHS {(ledgerBalance?.totalDue ?? balance?.amountDue ?? 0).toLocaleString()}</p></div>
                <div><p className="text-slate-500">Paid</p><p className="text-lg font-bold text-emerald-600">GHS {(ledgerBalance?.totalPaid ?? balance?.totalPaid ?? 0).toLocaleString()}</p></div>
                <div className="col-span-2 md:col-span-4"><p className="text-slate-500">Outstanding</p><p className="text-xl font-bold text-amber-700">GHS {(ledgerBalance?.outstanding ?? balance?.outstanding ?? 0).toLocaleString()}</p></div>
              </div>
            </CardContent>
          </Card>
          <Card className="records-print-card">
            <CardHeader><CardTitle>Per-Term Ledger Lines</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Academic Year</TableHead><TableHead>Term</TableHead><TableHead>Term Fees</TableHead><TableHead>Arrears</TableHead><TableHead>Amount Due</TableHead><TableHead>Total Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fees.summaryByTerm || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.academicYear}</TableCell>
                      <TableCell>{r.term}</TableCell>
                      <TableCell>GHS {r.totalFees?.toLocaleString()}</TableCell>
                      <TableCell>GHS {(r.arrears ?? 0).toLocaleString()}</TableCell>
                      <TableCell>GHS {(r.amountDue ?? (r.totalFees ?? 0) + (r.arrears ?? 0)).toLocaleString()}</TableCell>
                      <TableCell>GHS {r.totalPaid?.toLocaleString()}</TableCell>
                      <TableCell className="font-semibold text-amber-700">GHS {Math.max(0, r.outstanding ?? 0).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={r.status === 'Owing' ? 'destructive' : r.status === 'Credit' ? 'secondary' : 'default'}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(!fees.summaryByTerm || fees.summaryByTerm.length === 0) && (
                    <TableRow><TableCell colSpan={8} className="text-center text-slate-500">No fee data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="records-print-card">
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Term</TableHead><TableHead>Amount</TableHead><TableHead>Receipt</TableHead><TableHead>Recorded By</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fees.paymentHistory || []).map((r: any, i: number) => (
                    <TableRow key={i} className={r.voided ? 'opacity-60' : undefined}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.term || '—'}</TableCell>
                      <TableCell>GHS {r.amount?.toLocaleString()}</TableCell>
                      <TableCell>{r.receiptNumber || '—'}</TableCell>
                      <TableCell>{r.recordedBy}</TableCell>
                      <TableCell>
                        <Badge variant={r.voided ? 'outline' : 'default'}>{r.voided ? 'Voided' : 'Active'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!fees.paymentHistory || fees.paymentHistory.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-500">No payments</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-4 records-tab-panel" data-print-label="All Receipts">
          <Card className="records-print-card">
            <CardHeader>
              <CardTitle>All Student Receipts ({receipts.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt No.</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Recorded By</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.map((r: any, i: number) => (
                    <TableRow key={r.id ?? i} className={r.voided ? 'opacity-60' : undefined}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell className="font-medium">{r.receiptNumber || '—'}</TableCell>
                      <TableCell>{r.term || '—'}</TableCell>
                      <TableCell>{r.academicYear || '—'}</TableCell>
                      <TableCell>GHS {r.amount?.toLocaleString()}</TableCell>
                      <TableCell>{r.paymentMethod || '—'}</TableCell>
                      <TableCell>{r.recordedBy}</TableCell>
                      <TableCell>
                        <Badge variant={r.voided ? 'outline' : 'default'}>{r.voided ? 'Voided' : 'Active'}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {receipts.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-slate-500">No receipts on record</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4 records-tab-panel" data-print-label="Academic Performance">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Grades</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Subject/Assignment</TableHead><TableHead>Score</TableHead><TableHead>Max</TableHead><TableHead>Percentage</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(acad.grades || []).map((g: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{g.assignmentName}</TableCell>
                      <TableCell>{g.score}</TableCell>
                      <TableCell>{g.maxScore}</TableCell>
                      <TableCell>{g.maxScore ? Math.round((g.score / g.maxScore) * 100) : 0}%</TableCell>
                    </TableRow>
                  ))}
                  {(!acad.grades || acad.grades.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500">No grades</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="mt-4 text-sm font-medium">Term Average: {acad.termAverage ?? 0}%</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attendance" className="space-y-4 records-tab-panel" data-print-label="Attendance">
          <Card className="records-print-card">
            <CardContent className="pt-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div><p className="text-sm text-slate-500">Present</p><p className="text-xl font-bold text-emerald-600">{att.totalPresent ?? 0}</p></div>
                <div><p className="text-sm text-slate-500">Absent</p><p className="text-xl font-bold text-red-600">{att.totalAbsent ?? 0}</p></div>
                <div><p className="text-sm text-slate-500">Percentage</p><p className="text-xl font-bold">{att.attendancePercentage ?? 0}%</p></div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(att.dailyRecords || []).slice(0, 50).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell>{r.date}</TableCell><TableCell><Badge variant={r.status === 'Present' ? 'default' : 'destructive'}>{r.status}</Badge></TableCell></TableRow>
                  ))}
                  {(!att.dailyRecords || att.dailyRecords.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="text-center text-slate-500">No attendance records</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4 records-tab-panel" data-print-label="Activity Log">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Performed By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activity.map((a: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(a.date).toLocaleString()}</TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell>{a.performedBy}</TableCell>
                    </TableRow>
                  ))}
                  {activity.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-slate-500">No activity</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TeacherStaffProfileView({ profile, onPrint, onExportPDF, onExportExcel }: { profile: any; onPrint: () => void; onExportPDF: () => void; onExportExcel: () => void }) {
  const h = profile.header || {};
  const printDate = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div id="printable-profile" className="space-y-6">
      <div className="records-print-header">
        <h1 className="text-xl font-bold text-slate-900">Staff Full Report</h1>
        <p className="text-sm text-slate-600 mt-1">
          {h.fullName} · ID: {h.staffId} · {h.role}
        </p>
        <p className="text-xs text-slate-500 mt-1">Generated on {printDate}</p>
      </div>

      <div className="flex justify-end gap-2 records-no-print">
        <Button variant="outline" size="sm" onClick={onPrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
        <Button variant="outline" size="sm" onClick={onExportPDF}><FileDown className="h-4 w-4 mr-1" /> Export PDF</Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel</Button>
      </div>

      <Card className="records-print-card">
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
            <RecordsProfilePhoto
              entityType="teacher"
              entityId={h.id}
              fullName={h.fullName}
              hasPassportPhoto={h.hasPassportPhoto}
              photoUrl={h.passportPhotoUrl}
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-800">{h.fullName}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">ID: {h.staffId}</Badge>
                <Badge variant="secondary">{h.role}</Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 text-sm text-slate-600">
                <p><span className="font-medium">Department:</span> {h.department}</p>
                <p><span className="font-medium">Employment:</span> {h.employmentDate}</p>
                <p><span className="font-medium">Salary:</span> GHS {(h.salary || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-100 records-tab-list">
          <TabsTrigger value="overview"><User className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="salary"><DollarSign className="h-4 w-4 mr-1" /> Salary & Payments</TabsTrigger>
          <TabsTrigger value="classes"><FileText className="h-4 w-4 mr-1" /> Classes Assigned</TabsTrigger>
          <TabsTrigger value="activity"><History className="h-4 w-4 mr-1" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="records-tab-panel" data-print-label="Overview">
          <Card className="records-print-card">
            <CardContent className="pt-6">
              <p className="text-slate-600">Classes: {(profile.overview?.classesAssigned || []).join(', ') || 'None'}</p>
              <p className="text-slate-600 mt-2">Total salary payments: {profile.overview?.totalSalaryPayments ?? 0}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary" className="records-tab-panel" data-print-label="Salary & Payments">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Salary & Payments</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Month</TableHead><TableHead>Year</TableHead><TableHead>Salary</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(profile.salaryPayments || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.month}</TableCell>
                      <TableCell>{r.year}</TableCell>
                      <TableCell>GHS {r.salaryAmount?.toLocaleString()}</TableCell>
                      <TableCell>GHS {r.paidAmount?.toLocaleString()}</TableCell>
                      <TableCell>GHS {r.balance?.toLocaleString()}</TableCell>
                      <TableCell>{r.paymentDate || '—'}</TableCell>
                      <TableCell><Badge variant={r.status === 'Paid' ? 'default' : 'destructive'}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(!profile.salaryPayments || profile.salaryPayments.length === 0) && (
                    <TableRow><TableCell colSpan={7} className="text-center text-slate-500">No salary payments</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="classes" className="records-tab-panel" data-print-label="Classes Assigned">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Classes Assigned</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Class</TableHead><TableHead>Main</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(profile.classesAssigned || []).map((r: any, i: number) => (
                    <TableRow key={i}><TableCell>{r.class_name}</TableCell><TableCell>{r.is_main ? 'Yes' : 'No'}</TableCell></TableRow>
                  ))}
                  {(!profile.classesAssigned || profile.classesAssigned.length === 0) && (
                    <TableRow><TableCell colSpan={2} className="text-center text-slate-500">No classes assigned</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="records-tab-panel" data-print-label="Activity Log">
          <Card className="records-print-card">
            <CardHeader><CardTitle>Activity Log</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Action</TableHead><TableHead>Performed By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(profile.activityLog || []).map((a: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{new Date(a.date).toLocaleString()}</TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell>{a.performedBy}</TableCell>
                    </TableRow>
                  ))}
                  {(!profile.activityLog || profile.activityLog.length === 0) && (
                    <TableRow><TableCell colSpan={3} className="text-center text-slate-500">No activity</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RecordsModule;
