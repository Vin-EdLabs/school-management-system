
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Search, AlertTriangle, Download, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { calculateStudentFees, getActiveAcademicTerm } from '../../utils/feeCalculations';

const OutstandingFees = () => {
  const { students, classes, feeStructures, payments } = useData();
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
        const matchesSearch = student.studentName.toLowerCase().includes(searchTerm.toLowerCase());
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
    return ['All', ...classesArray.map(cls => cls.className)];
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
          <div className="flex items-center justify-between">
            <CardTitle>Outstanding Fees Overview</CardTitle>
            <div className="flex items-center space-x-2">
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                  <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                  <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={exportOutstandingReport} size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
