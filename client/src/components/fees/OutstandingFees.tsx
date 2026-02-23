
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { AlertTriangle, Clock, DollarSign, Download, Search, TrendingUp } from 'lucide-react';
import React, { useMemo, useState, useEffect } from 'react';
import { calculateStudentFees, getActiveAcademicTerm } from '../../utils/feeCalculations';

interface OutstandingFeesProps {
  compact?: boolean;
}

const OutstandingFees: React.FC<OutstandingFeesProps> = ({ compact = false }) => {
  const { students: rawStudents } = useStudents();
  const { classes: rawClasses } = useClasses();
  const { feeStructures: rawFeeStructures } = useFeeStructures();
  const { payments: rawPayments } = usePayments();

  // fetched data from backend (used as fallback if hooks don't provide data)
  const [fetchedStudents, setFetchedStudents] = useState<any[]>([]);
  const [fetchedClasses, setFetchedClasses] = useState<any[]>([]);
  const [fetchedFeeStructures, setFetchedFeeStructures] = useState<any[]>([]);
  const [fetchedPayments, setFetchedPayments] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchIfAvailable = async (url: string, setter: (v: any[]) => void) => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`${url} returned ${res.status}`);
          return;
        }
        const json = await res.json();
        if (!mounted) return;
        setter(Array.isArray(json) ? json : []);
      } catch (err: any) {
        console.warn(`Failed fetching ${url}:`, err);
      }
    };

    // fetch individually so a single missing endpoint doesn't block others
    fetchIfAvailable('/api/students', setFetchedStudents);
    fetchIfAvailable('/api/classes', setFetchedClasses);
    fetchIfAvailable('/api/fee-structures', setFetchedFeeStructures);
    fetchIfAvailable('/api/payments', setFetchedPayments);

    return () => {
      mounted = false;
    };
  }, []);

  const students = ((fetchedStudents.length ? fetchedStudents : rawStudents) || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    studentId: s.studentId || s.student_id || s.id || '',
    classAssigned: (s.classAssigned || s.class_assigned || (() => {
      const classesSource = (fetchedClasses.length ? fetchedClasses : rawClasses) || [];
      const cid = s.class_id ?? s.classId ?? s.class;
      if (!cid) return '';
      const match = classesSource.find((c: any) => String(c.id) === String(cid) || String(c.class_id) === String(cid));
      return match ? (match.className || match.name || match.class_name || '') : '';
    })())
  }));

  const classes = ((fetchedClasses.length ? fetchedClasses : rawClasses) || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.className || c.class_name || c.name || ''
  }));

  const feeStructures = ((fetchedFeeStructures.length ? fetchedFeeStructures : rawFeeStructures) || []).map((f: any) => ({
    id: f.id ?? String(f.id),
    className: f.className || f.class_name || '',
    term: f.term || f.term_name || f.termName || '',
    amount: Number(f.amount || f.fee || 0),
    arrears: f.arrears || 0
  }));

  const payments = ((fetchedPayments.length ? fetchedPayments : rawPayments) || []).map((p: any) => ({
    id: p.id ?? String(p.id),
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || '',
    amount: Number(p.amount || 0)
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const [selectedTerm, setSelectedTerm] = useState(getActiveAcademicTerm());

  // Calculate outstanding fees for all students
  const outstandingData = useMemo(() => {
    const studentsArray = Array.isArray(students) ? students : [];
    const paymentsArray = Array.isArray(payments) ? payments : [];

    return studentsArray.map(student => {
      const feeCalculation = calculateStudentFees(
        student.id,
        selectedTerm,
        student.classAssigned,
        feeStructures,
        paymentsArray
      );

      const outstanding = Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid);

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.classAssigned,
        currentTermFee: feeCalculation.currentTermFee,
        matchedFeeStructure: feeCalculation.matchedFeeStructure ?? null,
        arrears: feeCalculation.arrears,
        creditBalance: feeCalculation.creditBalance,
        totalAmountDue: feeCalculation.totalAmountDue,
        totalPaid: feeCalculation.totalPaid,
        outstanding: outstanding,
        paymentHistory: paymentsArray.filter(p => p.studentId === student.id)
      };
    });
  }, [students, payments, feeStructures, selectedTerm]);

  // Filter students with outstanding balances
  const filteredStudents = useMemo(() => {
    return outstandingData
      .filter(student => student.outstanding > 0)
      .filter(student => {
        const q = searchTerm.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (student.studentName || '').toLowerCase().includes(q) ||
          (student.studentId || '').toLowerCase().includes(q);
        const matchesClass = selectedClass === 'All' || student.className === selectedClass;
        return matchesSearch && matchesClass;
      })
      .sort((a, b) => b.outstanding - a.outstanding);
  }, [outstandingData, searchTerm, selectedClass]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const outstandingStudents = outstandingData.filter(student => student.outstanding > 0);
    const studentsArray = Array.isArray(students) ? students : [];
    const totalStudents = studentsArray.length;
    const studentsOwing = outstandingStudents.length;
    const totalOutstanding = outstandingStudents.reduce((sum, student) => sum + student.outstanding, 0);
    const hasPartialPayments = outstandingStudents.some(student => student.totalPaid > 0);
    const averageOutstanding = studentsOwing > 0 ? totalOutstanding / studentsOwing : 0;
    const totalArrears = outstandingStudents.reduce((sum, student) => sum + student.arrears, 0);

    return {
      totalStudents,
      studentsOwing,
      totalOutstanding,
      hasPartialPayments,
      averageOutstanding,
      totalArrears
    };
  }, [outstandingData, students]);

  // Get unique classes for filter
  const uniqueClasses = useMemo(() => {
    const classesArray = Array.isArray(classes) ? classes : [];
    // filter out empty/falsy class names and deduplicate
    const names = classesArray
      .map(cls => cls.className)
      .filter(name => !!name);
    const unique = Array.from(new Set(names));
    return ['All', ...unique];
  }, [classes]);

  const exportOutstandingReport = () => {
    const reportData = filteredStudents.map(student => ({
      'Student Name': student.studentName,
      'Class': student.className,
      'Current Term Fee': student.currentTermFee,
      'Arrears': student.arrears,
      'Total Due': student.totalAmountDue,
      'Total Paid': student.totalPaid,
      'Outstanding Balance': student.outstanding,
      'Payment Count': student.paymentHistory.length
    }));

    const csvContent = [
      Object.keys(reportData[0] || {}).join(','),
      ...reportData.map(row => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outstanding-fees-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report Exported",
      description: `Outstanding fees report for ${filteredStudents.length} students has been exported`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with summary stats */}
      <div className={compact ? 'grid grid-cols-2 gap-4' : 'grid grid-cols-1 md:grid-cols-4 gap-4'}>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-sm text-gray-600">Students Owing</p>
                <p className="text-2xl font-bold">{summaryStats.studentsOwing}</p>
                <p className="text-xs text-gray-500">of {summaryStats.totalStudents} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-gray-600">Total Outstanding</p>
                <p className="text-2xl font-bold">GHS {summaryStats.totalOutstanding.toLocaleString()}</p>
                <p className="text-xs text-gray-500">across all students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-gray-600">Total Arrears</p>
                <p className="text-2xl font-bold">GHS {summaryStats.totalArrears.toLocaleString()}</p>
                <p className="text-xs text-gray-500">from previous terms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-gray-600">Average Outstanding</p>
                <p className="text-2xl font-bold">GHS {summaryStats.averageOutstanding.toLocaleString()}</p>
                <p className="text-xs text-gray-500">per student owing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <div className={compact ? 'flex flex-col items-start gap-2' : 'flex items-center justify-between'}>
            <div className="min-w-0 w-full">
              <CardTitle className="truncate max-w-[420px]  text-xl">Outstanding Fees Overview</CardTitle>
            </div>
            <div className={compact ? 'flex items-center space-x-2 w-full' : 'flex items-center space-x-2 flex-shrink-0 whitespace-nowrap'}>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className={compact ? 'w-full' : 'w-28 sm:w-40'}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                  <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                  <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportOutstandingReport} size="sm" className={compact ? 'w-full sm:w-auto' : 'whitespace-nowrap'}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Debug panel: shows resolved class and matched fee structure for first search match */}
          {searchTerm.trim() !== '' && (() => {
            const q = searchTerm.toLowerCase().trim();
            const match = outstandingData.find(s => (s.studentName || '').toLowerCase().includes(q) || (String(s.studentId || '')).toLowerCase().includes(q));
            if (!match) return null;
            return (
              <div className="mb-4 p-3 bg-gray-50 border rounded text-sm">
                <div className="font-medium mb-1">Debug: Resolved Fee for {match.studentName}</div>
                <div>Resolved Class: <span className="font-mono">{match.className || '[none]'}</span></div>
                <div>Current Term Fee: GHS <span className="font-mono">{match.currentTermFee.toLocaleString()}</span></div>
                <div>Matched Fee Structure: <pre className="whitespace-pre-wrap text-xs mt-2">{JSON.stringify(match.matchedFeeStructure ?? { matched: false }, null, 2)}</pre></div>
              </div>
            );
          })()}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search students..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uniqueClasses.map(className => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outstanding Students Table */}
          {filteredStudents.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3">Student</th>
                    <th className="text-left p-3">Class</th>
                    <th className="text-left p-3">Term Fee</th>
                    <th className="text-left p-3">Arrears</th>
                    <th className="text-left p-3">Total Due</th>
                    <th className="text-left p-3">Paid</th>
                    <th className="text-left p-3">Outstanding</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr key={student.studentId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{student.studentName}</p>
                          <p className="text-sm text-gray-500">ID: {student.studentId}</p>
                        </div>
                      </td>
                      <td className="p-3">{student.className}</td>
                      <td className="p-3">GHS {student.currentTermFee.toLocaleString()}</td>
                      <td className="p-3">
                        {student.arrears > 0 ? (
                          <span className="text-orange-600 font-medium">
                            GHS {student.arrears.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">GHS {student.totalAmountDue.toLocaleString()}</td>
                      <td className="p-3">
                        <span className="text-green-600">
                          GHS {student.totalPaid.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-red-600 font-bold">
                          GHS {student.outstanding.toLocaleString()}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col space-y-1">
                          <Badge variant={student.arrears > 0 ? "destructive" : "secondary"}>
                            {student.arrears > 0 ? "Has Arrears" : "Current Term"}
                          </Badge>
                          {student.totalPaid > 0 && (
                            <Badge variant="outline" className="text-xs">
                              Partial Payment
                            </Badge>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Outstanding Fees</h3>
              <p className="text-gray-600">
                {searchTerm || selectedClass !== 'All'
                  ? 'No students match your current filters.'
                  : 'All students have paid their fees for this term.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OutstandingFees;
