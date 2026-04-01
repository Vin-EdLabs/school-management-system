import React, { useState } from 'react';
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
import { Search, User, FileText, DollarSign, Award, UserCheck, History, Printer, FileDown, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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
      rows.push(['Academic Year', 'Term', 'Total Fees', 'Total Paid', 'Outstanding', 'Status']);
      (p.fees?.summaryByTerm || []).forEach((r: any) => {
        rows.push([r.academicYear, r.term, String(r.totalFees), String(r.totalPaid), String(r.outstanding), r.status]);
      });
      rows.push(['', '']);
      rows.push(['Payment History', '']);
      rows.push(['Date', 'Amount', 'Receipt Number', 'Recorded By']);
      (p.fees?.paymentHistory || []).forEach((r: any) => {
        rows.push([r.date, String(r.amount), r.receiptNumber || '', r.recordedBy || '']);
      });
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

      <Card className="print:hidden">
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

function StudentProfileView({ profile, onPrint, onExportPDF, onExportExcel }: { profile: any; onPrint: () => void; onExportPDF: () => void; onExportExcel: () => void }) {
  const h = profile.header || {};
  const ov = profile.overview || {};
  const fees = profile.fees || {};
  const acad = profile.academicPerformance || {};
  const att = profile.attendance || {};
  const activity = profile.activityLog || [];

  return (
    <div id="printable-profile" className="space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
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

      <Card className="overflow-hidden">
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
            <Avatar className="h-24 w-24 rounded-xl border-2 border-white shadow">
              {h.passportPhotoUrl ? (
                <AvatarImage src={resolveLogoUrl(h.passportPhotoUrl) || undefined} className="object-cover" />
              ) : null}
              <AvatarFallback className="rounded-xl bg-slate-200 text-slate-600 text-2xl">
                {h.firstName?.[0]}{h.lastName?.[0]}
              </AvatarFallback>
            </Avatar>
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
                <p><span className="font-medium">Guardian:</span> {h.guardianName} — {h.guardianContact}</p>
                <p><span className="font-medium">Admission:</span> {h.admissionDate}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview"><User className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="fees"><DollarSign className="h-4 w-4 mr-1" /> Fees</TabsTrigger>
          <TabsTrigger value="academic"><Award className="h-4 w-4 mr-1" /> Academic</TabsTrigger>
          <TabsTrigger value="attendance"><UserCheck className="h-4 w-4 mr-1" /> Attendance</TabsTrigger>
          <TabsTrigger value="activity"><History className="h-4 w-4 mr-1" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Fees Assigned</p><p className="text-xl font-bold">GHS {ov.totalFeesAssigned?.toLocaleString() || 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Total Paid</p><p className="text-xl font-bold text-emerald-600">GHS {ov.totalPaid?.toLocaleString() || 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Outstanding</p><p className="text-xl font-bold text-amber-600">GHS {ov.totalOutstanding?.toLocaleString() || 0}</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Term Average</p><p className="text-xl font-bold">{(ov.currentTermAverage || 0)}%</p></CardContent></Card>
            <Card><CardContent className="pt-4"><p className="text-sm text-slate-500">Attendance</p><p className="text-xl font-bold">{ov.attendancePercentage ?? 0}%</p></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="fees" className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Fee Summary by Term</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Academic Year</TableHead><TableHead>Term</TableHead><TableHead>Total Fees</TableHead><TableHead>Total Paid</TableHead><TableHead>Outstanding</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fees.summaryByTerm || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.academicYear}</TableCell>
                      <TableCell>{r.term}</TableCell>
                      <TableCell>GHS {r.totalFees?.toLocaleString()}</TableCell>
                      <TableCell>GHS {r.totalPaid?.toLocaleString()}</TableCell>
                      <TableCell>GHS {r.outstanding?.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={r.status === 'Owing' ? 'destructive' : r.status === 'Credit' ? 'secondary' : 'default'}>{r.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {(!fees.summaryByTerm || fees.summaryByTerm.length === 0) && (
                    <TableRow><TableCell colSpan={6} className="text-center text-slate-500">No fee data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Payment History</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Receipt</TableHead><TableHead>Recorded By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(fees.paymentHistory || []).map((r: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>GHS {r.amount?.toLocaleString()}</TableCell>
                      <TableCell>{r.receiptNumber || '—'}</TableCell>
                      <TableCell>{r.recordedBy}</TableCell>
                    </TableRow>
                  ))}
                  {(!fees.paymentHistory || fees.paymentHistory.length === 0) && (
                    <TableRow><TableCell colSpan={4} className="text-center text-slate-500">No payments</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="academic" className="space-y-4">
          <Card>
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

        <TabsContent value="attendance" className="space-y-4">
          <Card>
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

        <TabsContent value="activity" className="space-y-4">
          <Card>
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

  return (
    <div id="printable-profile" className="space-y-6">
      <div className="flex justify-end gap-2 print:hidden">
        <Button variant="outline" size="sm" onClick={onPrint}><Printer className="h-4 w-4 mr-1" /> Print</Button>
        <Button variant="outline" size="sm" onClick={onExportPDF}><FileDown className="h-4 w-4 mr-1" /> Export PDF</Button>
        <Button variant="outline" size="sm" onClick={onExportExcel}><FileSpreadsheet className="h-4 w-4 mr-1" /> Export Excel</Button>
      </div>

      <Card>
        <CardContent className="pt-0">
          <div className="flex flex-col md:flex-row gap-6 p-6 bg-gradient-to-r from-slate-50 to-slate-100 rounded-t-xl">
            <Avatar className="h-24 w-24 rounded-xl border-2 border-white shadow">
              <AvatarFallback className="rounded-xl bg-slate-200 text-slate-600 text-2xl">
                {h.fullName?.split(/\s+/).map((n: string) => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
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
        <TabsList className="bg-slate-100">
          <TabsTrigger value="overview"><User className="h-4 w-4 mr-1" /> Overview</TabsTrigger>
          <TabsTrigger value="salary"><DollarSign className="h-4 w-4 mr-1" /> Salary & Payments</TabsTrigger>
          <TabsTrigger value="classes"><FileText className="h-4 w-4 mr-1" /> Classes Assigned</TabsTrigger>
          <TabsTrigger value="activity"><History className="h-4 w-4 mr-1" /> Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardContent className="pt-6">
              <p className="text-slate-600">Classes: {(profile.overview?.classesAssigned || []).join(', ') || 'None'}</p>
              <p className="text-slate-600 mt-2">Total salary payments: {profile.overview?.totalSalaryPayments ?? 0}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="salary">
          <Card>
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

        <TabsContent value="classes">
          <Card>
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

        <TabsContent value="activity">
          <Card>
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
