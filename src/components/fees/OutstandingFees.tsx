
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { Search, AlertTriangle, Download, DollarSign, Clock, TrendingUp } from 'lucide-react';
import { apiService } from '../../services/api';
import { calculateStudentFeesSync, getActiveAcademicTerm } from '../../utils/feeCalculations';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';

const OutstandingFees = () => {
  const { students, classes, feeStructures, payments, ledgerBalances } = useData();
  const { currentTerm } = useActiveTerm();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState('All');
  const selectedTerm = currentTerm && currentTerm !== 'Not Set' ? currentTerm : getActiveAcademicTerm();

  // Calculate outstanding fees for all students using ledger-backed balances when available.
  const outstandingData = useMemo(() => {
    const studentsArray = Array.isArray(students) ? students : [];
    const paymentsArray = Array.isArray(payments) ? payments : [];

    return studentsArray.filter(shouldTrackStudentFees).map(student => {
      const ledgerBalance = ledgerBalances?.[String(student.id)];
      const paymentHistory = paymentsArray.filter((p: any) =>
        String(p.studentId) === String(student.id) &&
        (p.term === selectedTerm || (p.term && (p.term.includes(selectedTerm) || selectedTerm.includes(p.term))))
      );

      if (ledgerBalance) {
        return {
          studentId: student.id,
          admissionNo: student.studentId || student.admissionNumber || String(student.id),
          studentName: `${student.firstName} ${student.lastName}`,
          className: student.classAssigned,
          currentTermFee: ledgerBalance.currentTermFee,
          arrears: ledgerBalance.totalArrears,
          creditBalance: ledgerBalance.credit,
          totalAmountDue: ledgerBalance.totalDue,
          totalPaid: ledgerBalance.totalPaid,
          outstanding: Math.max(0, ledgerBalance.outstanding),
          paymentHistory,
        };
      }

      const feeCalculation = calculateStudentFeesSync(
        student.id,
        selectedTerm,
        student.classAssigned,
        feeStructures || [],
        paymentsArray,
        student.classAssignedId,
        undefined,
        {
          isBeneficiary: !!student.isBeneficiary,
          discountType: student.discountType,
          discountValue: student.discountValue,
        }
      );

      const outstanding = Math.max(0, (feeCalculation.totalAmountDue ?? feeCalculation.currentTermFee) - feeCalculation.totalPaid);

      return {
        studentId: student.id,
        admissionNo: student.studentId || student.admissionNumber || String(student.id),
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.classAssigned,
        currentTermFee: feeCalculation.currentTermFee,
        arrears: feeCalculation.arrears,
        creditBalance: feeCalculation.creditBalance,
        totalAmountDue: feeCalculation.totalAmountDue,
        totalPaid: feeCalculation.totalPaid,
        outstanding,
        paymentHistory,
      };
    });
  }, [students, payments, feeStructures, selectedTerm, ledgerBalances]);

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
    const studentsArray = Array.isArray(students) ? students.filter(shouldTrackStudentFees) : [];
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
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-orange-500/5 border border-orange-500/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm backdrop-blur-sm group hover:border-orange-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-orange-500/10 p-2 rounded-xl text-orange-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.1em] font-black text-orange-500/60">Students</p>
          </div>
          <div>
            <p className="text-2xl font-black text-foreground tracking-tight">{summaryStats.studentsOwing}</p>
            <p className="text-[10px] text-muted-foreground font-medium">of {summaryStats.totalStudents} students owing</p>
          </div>
        </div>

        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm backdrop-blur-sm group hover:border-red-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-red-500/10 p-2 rounded-xl text-red-500">
              <DollarSign className="w-5 h-5" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.1em] font-black text-red-500/60">Outstanding</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground tracking-tight">GHS {summaryStats.totalOutstanding.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground font-medium">total amount due</p>
          </div>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm backdrop-blur-sm group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-amber-500/10 p-2 rounded-xl text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.1em] font-black text-amber-500/60">Arrears</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground tracking-tight">GHS {summaryStats.totalArrears.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground font-medium">from previous terms</p>
          </div>
        </div>

        <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-2xl p-4 flex flex-col justify-between shadow-sm backdrop-blur-sm group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="bg-indigo-500/10 p-2 rounded-xl text-indigo-500">
              <TrendingUp className="w-5 h-5" />
            </div>
            <p className="text-[9px] uppercase tracking-[0.1em] font-black text-indigo-500/60">Average</p>
          </div>
          <div>
            <p className="text-xl font-black text-foreground tracking-tight">GHS {summaryStats.averageOutstanding.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground font-medium">per student owing</p>
          </div>
        </div>
      </div>

      {/* Filters and Table */}
      <div className="space-y-4 pt-4 border-t border-border/50">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 group">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-indigo-500 transition-colors" />
            <Input
              placeholder="Search students or admission numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-background/50 border-border/50 focus:border-indigo-500/50 rounded-xl"
            />
          </div>
          <div className="flex gap-2">
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-36 bg-background/50 border-border/50 rounded-xl">
                <SelectValue placeholder="Class" />
              </SelectTrigger>
              <SelectContent>
                {uniqueClasses.map(className => (
                  <SelectItem key={className} value={className}>
                    {className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={exportOutstandingReport} 
              variant="outline" 
              className="rounded-xl border-border/50 hover:bg-indigo-500/10 hover:text-indigo-500 hover:border-indigo-500/30"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
          </div>
        </div>

        {/* Outstanding Students Table */}
        {filteredStudents.length > 0 ? (
          <div className="rounded-2xl border border-border/50 overflow-hidden bg-card/30 backdrop-blur-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 bg-muted/40">
                  <th className="text-left p-3 font-bold text-muted-foreground uppercase tracking-wider">Student & Class</th>
                  <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Financials</th>
                  <th className="text-right p-3 font-bold text-muted-foreground uppercase tracking-wider">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredStudents.map((student) => (
                  <tr key={student.studentId} className="hover:bg-indigo-500/5 transition-colors group">
                    <td className="p-3 align-top">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground text-sm tracking-tight">{student.studentName}</span>
                          {student.arrears > 0 && (
                            <Badge variant="destructive" className="h-4 px-1.5 text-[8px] uppercase font-black tracking-tighter bg-red-500/20 text-red-500 border-red-500/20">Arrears</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/5 text-indigo-500 border border-indigo-500/10 text-[9px] font-bold">{student.className}</span>
                          <span className="text-[10px] opacity-40 font-mono">#{student.admissionNo}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right align-top">
                      <div className="flex flex-col">
                        <span className="text-foreground/90 font-medium">Due: GHS {student.totalAmountDue.toLocaleString()}</span>
                        <div className="flex justify-end gap-2 text-[9px] text-muted-foreground mt-0.5 opacity-60">
                          <span>Fee: {student.currentTermFee.toLocaleString()}</span>
                          {student.arrears > 0 && <span className="text-orange-500/70 font-semibold">Arr: {student.arrears.toLocaleString()}</span>}
                        </div>
                        <span className="text-emerald-500/80 font-bold text-[9px] mt-1">Paid: GHS {student.totalPaid.toLocaleString()}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right align-top">
                      <div className="flex flex-col items-end">
                        <span className="text-red-500 dark:text-red-400 font-black text-sm">
                          GHS {student.outstanding.toLocaleString()}
                        </span>
                        {student.totalPaid > 0 && (
                          <div className="flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md bg-emerald-500/5 text-emerald-500 border border-emerald-500/10 text-[8px] font-black uppercase tracking-tighter">
                            <TrendingUp className="w-2.5 h-2.5" />
                            Partial
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed border-border/50">
            <AlertTriangle className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground mb-1">Clear Ledger</h3>
            <p className="text-sm text-muted-foreground max-w-[200px] mx-auto leading-relaxed">
              {searchTerm || selectedClass !== 'All'
                ? 'No students matching these filters have outstanding balances.'
                : 'All students are up to date with their payments for this term.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OutstandingFees;
