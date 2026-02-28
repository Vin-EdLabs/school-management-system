import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { AlertTriangle, Clock, DollarSign, Download, Search, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { calculateStudentFees } from '../../utils/feeCalculations';
import { useActiveTerm, useSettings } from '@/hooks/useSettings';
import { useBalances } from '@/hooks/useBalances';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';

interface OutstandingFeesProps {
  compact?: boolean;
}

const OutstandingFees: React.FC<OutstandingFeesProps> = ({ compact = false }) => {
  const { toast } = useToast();
  const { students: rawStudents } = useStudents();
  const { classes: rawClasses } = useClasses();
  const { feeStructures: rawFeeStructures } = useFeeStructures();
  const { payments: rawPayments } = usePayments();
  const { terms } = useAcademicTerms();
  const { data: activeTermData } = useActiveTerm();

  const currentTermId = activeTermData?.id;
  const currentTermName = activeTermData?.name || 'Term 1';

  const [selectedTermName, setSelectedTermName] = useState('');
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);

  // Initialize selected term name from active term
  React.useEffect(() => {
    if (activeTermData && !selectedTermName) {
      setSelectedTermName(activeTermData.name);
      setSelectedTermId(activeTermData.id);
    }
  }, [activeTermData]);

  const { arrearsMap, creditMap } = useBalances(selectedTermId || currentTermId);

  const students = (rawStudents || []).map((s: any) => {
    const id = String(s.id ?? s.student_id ?? '');
    const firstName = s.first_name || s.firstName || '';
    const lastName = s.last_name || s.lastName || '';
    const studentId = String(s.admission_no || s.studentId || s.id || '');

    let classAssigned = (s.class_assigned || s.classAssigned || '');
    if ((!classAssigned || classAssigned === '') && s.class_id) {
      const cls = (rawClasses || []).find((c: any) => String(c.id) === String(s.class_id));
      if (cls) {
        classAssigned = cls.level && cls.stream ? `${cls.level} ${cls.stream}` : (cls.level || cls.class_name || cls.className || cls.name || '');
      }
    }

    const fullName = `${firstName} ${lastName}`.trim() || s.name || s.full_name || 'Unknown Student';

    return {
      ...s,
      id,
      firstName,
      lastName,
      fullName,
      studentId,
      classAssigned,
      classId: s.class_id || s.classId
    };
  });

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || '')
  }));

  const feeStructures = (rawFeeStructures || []).map((f: any) => ({
    ...f,
    id: f.id ?? String(f.id),
    className: f.name || f.className || f.class_name || '',
    class_id: f.class_id || f.classId,
    term: f.term || f.term_name || '',
    amount: Number(f.items?.amount || f.amount || 0),
    term_id: f.term_id || f.academicTermId || f.termId
  }));

  const payments = (rawPayments || []).map((p: any) => ({
    ...p,
    id: p.id ?? String(p.id),
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || '',
    term_id: p.term_id || p.termId,
    amount: Number(p.amount || 0)
  }));

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');

  // Calculate outstanding fees for all students
  const outstandingData = useMemo(() => {
    const termToUse = selectedTermName || currentTermName;
    return students.map(student => {
      const feeCalculation = calculateStudentFees(
        student.id,
        { name: selectedTermName || currentTermName, id: selectedTermId || currentTermId },
        student.classAssigned,
        feeStructures,
        payments,
        arrearsMap,
        creditMap
      );

      const outstanding = feeCalculation.remainingBalance;

      return {
        studentId: student.id,
        studentName: student.fullName,
        className: student.classAssigned,
        currentTermFee: feeCalculation.currentTermFee,
        matchedFeeStructure: feeCalculation.matchedFeeStructure ?? null,
        arrears: feeCalculation.arrears,
        creditBalance: feeCalculation.creditBalance,
        totalAmountDue: feeCalculation.totalAmountDue,
        totalPaid: feeCalculation.totalPaid,
        outstanding: outstanding,
        paymentHistory: payments.filter(p => String(p.studentId) === String(student.id))
      };
    });
  }, [students, payments, feeStructures, selectedTermName, currentTermName, arrearsMap, creditMap]);

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
                <p className="text-sm text-muted-foreground">Students Owing</p>
                <p className="text-2xl font-bold">{summaryStats.studentsOwing}</p>
                <p className="text-xs text-muted-foreground">of {summaryStats.totalStudents} total</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-bold">GHS {summaryStats.totalOutstanding.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">across all students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-500" />
              <div>
                <p className="text-sm text-muted-foreground">Total Arrears</p>
                <p className="text-2xl font-bold">GHS {summaryStats.totalArrears.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">from previous terms</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <div>
                <p className="text-sm text-muted-foreground">Average Outstanding</p>
                <p className="text-2xl font-bold">GHS {summaryStats.averageOutstanding.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">per student owing</p>
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
              <Select
                value={selectedTermName}
                onValueChange={(val) => {
                  setSelectedTermName(val);
                  const matched = terms.find((t: any) => t.name === val);
                  if (matched) setSelectedTermId(matched.id);
                }}
              >
                <SelectTrigger className={compact ? 'w-full' : 'w-28 sm:w-40'}>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  {terms.map((t: any) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name} {t.year}
                    </SelectItem>
                  ))}
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
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
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
                    <th className="text-left p-3">Money Left</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student, index) => (
                    <tr key={student.studentId} className="border-b hover:bg-muted/50">
                      <td className="p-3">
                        <div>
                          <p className="font-medium">{student.studentName}</p>
                          <p className="text-sm text-muted-foreground">ID: {student.studentId}</p>
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
                          <span className="text-muted-foreground">-</span>
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
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Outstanding Fees</h3>
              <p className="text-muted-foreground">
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
