
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { TrendingUp, Users, User, AlertTriangle, DollarSign } from 'lucide-react';
import { 
  calculateStudentFees, 
  calculateStudentFeesSync,
  processFeesForClassPromotion,
  processArrearsForTermChange 
} from '../../utils/feeCalculations';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

type PromoteStudentsProps = {
  initialStudentId?: string | null;
  onConsumeInitialStudentId?: () => void;
};

const PromoteStudents: React.FC<PromoteStudentsProps> = ({
  initialStudentId = null,
  onConsumeInitialStudentId,
}) => {
  const { students, classes, promoteStudent, promoteClass, feeStructures, payments } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const [promotionType, setPromotionType] = useState<'individual' | 'class'>('individual');
  const [selectedStudent, setSelectedStudent] = useState('');

  useEffect(() => {
    if (!initialStudentId) return;
    const exists = students.some((s) => s.id === String(initialStudentId));
    if (!exists) return;
    setPromotionType('individual');
    setSelectedStudent(String(initialStudentId));
    onConsumeInitialStudentId?.();
  }, [initialStudentId, students, onConsumeInitialStudentId]);
  const [selectedCurrentClass, setSelectedCurrentClass] = useState('');
  const [selectedNewClass, setSelectedNewClass] = useState('');
  const [showFeeWarning, setShowFeeWarning] = useState(false);
  const [feeImpactData, setFeeImpactData] = useState<any>(null);

  // Calculate fee impact for individual promotion
  const calculateIndividualFeeImpact = async (studentId: string, newClass: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;

    const currentFeeCalc = await calculateStudentFees(
      studentId,
      currentTerm,
      student.classAssigned,
      feeStructures,
      payments,
      currentYear
    );

    const outstandingBalance = Math.max(0, currentFeeCalc.totalAmountDue - currentFeeCalc.totalPaid);

    return {
      studentName: `${student.firstName} ${student.lastName}`,
      currentClass: student.classAssigned,
      newClass: newClass,
      currentTermFee: currentFeeCalc.currentTermFee,
      arrears: currentFeeCalc.arrears,
      totalPaid: currentFeeCalc.totalPaid,
      outstandingBalance: outstandingBalance,
      willBecomeArrears: outstandingBalance > 0
    };
  };

  // Calculate fee impact for class promotion
  const calculateClassFeeImpact = async (currentClass: string, newClass: string) => {
    const studentsInClass = students.filter(s => s.classAssigned === currentClass);
    
    const impactDataPromises = studentsInClass.map(async (student) => {
      const feeCalc = await calculateStudentFees(
        student.id,
        currentTerm,
        student.classAssigned,
        feeStructures,
        payments,
        currentYear
      );

      const outstandingBalance = Math.max(0, feeCalc.totalAmountDue - feeCalc.totalPaid);

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        currentTermFee: feeCalc.currentTermFee,
        arrears: feeCalc.arrears,
        totalPaid: feeCalc.totalPaid,
        outstandingBalance: outstandingBalance,
        willBecomeArrears: outstandingBalance > 0
      };
    });
    
    const impactData = await Promise.all(impactDataPromises);

    const studentsWithOutstanding = impactData.filter(s => s.willBecomeArrears);
    const totalOutstanding = studentsWithOutstanding.reduce((sum, s) => sum + s.outstandingBalance, 0);

    return {
      totalStudents: studentsInClass.length,
      studentsWithOutstanding: studentsWithOutstanding.length,
      totalOutstandingAmount: totalOutstanding,
      studentDetails: impactData
    };
  };

  const handleIndividualPromotion = async () => {
    if (!selectedStudent || !selectedNewClass) {
      toast({
        title: "Validation Error",
        description: "Please select both student and new class",
        variant: "destructive"
      });
      return;
    }

    const student = students.find(s => s.id === selectedStudent);
    if (!student) return;

    const feeImpact = await calculateIndividualFeeImpact(selectedStudent, selectedNewClass);
    
    if (feeImpact && feeImpact.willBecomeArrears) {
      setFeeImpactData(feeImpact);
      setShowFeeWarning(true);
    } else {
      await executeIndividualPromotion();
    }
  };

  const executeIndividualPromotion = async () => {
    const student = students.find(s => s.id === selectedStudent);
    if (!student) return;

    const newClassObj = classes.find(c => c.id === selectedNewClass || c.className === selectedNewClass);
    const oldClassObj = classes.find(c => c.id === student.classAssignedId?.toString() || c.className === student.classAssigned);
    
    if (!newClassObj || !oldClassObj) {
      toast({
        title: "Error",
        description: "Could not find class information",
        variant: "destructive"
      });
      return;
    }

    // Process fee arrears if any (this is now handled by backend)
    const outstandingAmount = await processFeesForClassPromotion(
      selectedStudent,
      parseInt(oldClassObj.id),
      parseInt(newClassObj.id),
      currentTerm,
      currentYear
    );

    // Promote the student (backend handles fee carryover)
    await promoteStudent(selectedStudent, selectedNewClass, currentTerm, currentYear);
    
    let message = `${student.firstName} ${student.lastName} has been promoted to ${selectedNewClass}`;
    if (outstandingAmount > 0) {
      message += `. Outstanding balance of GHS ${outstandingAmount.toLocaleString()} has been added to arrears.`;
    }

    toast({
      title: "Student Promoted Successfully",
      description: message,
    });

    // Reset form
    setSelectedStudent('');
    setSelectedNewClass('');
    setShowFeeWarning(false);
    setFeeImpactData(null);
  };

  const handleClassPromotion = async () => {
    if (!selectedCurrentClass || !selectedNewClass) {
      toast({
        title: "Validation Error",
        description: "Please select both current class and new class",
        variant: "destructive"
      });
      return;
    }

    const feeImpact = await calculateClassFeeImpact(selectedCurrentClass, selectedNewClass);
    
    if (feeImpact.studentsWithOutstanding > 0) {
      setFeeImpactData(feeImpact);
      setShowFeeWarning(true);
    } else {
      await executeClassPromotion();
    }
  };

  const executeClassPromotion = async () => {
    const studentsInClass = students.filter(s => s.classAssigned === selectedCurrentClass);
    const currentClassObj = classes.find(c => c.className === selectedCurrentClass || c.id === selectedCurrentClass);
    const newClassObj = classes.find(c => c.className === selectedNewClass || c.id === selectedNewClass);
    if (!currentClassObj || !newClassObj) return;

    // Process fee arrears/credits for each student (outstanding→arrears, credit→student_credits)
    let totalArrears = 0;
    await Promise.all(studentsInClass.map(async (student) => {
      const outstandingAmount = await processFeesForClassPromotion(
        student.id,
        parseInt(currentClassObj.id),
        parseInt(newClassObj.id),
        currentTerm,
        currentYear
      );
      totalArrears += outstandingAmount;
    }));

    // Promote the entire class
    await promoteClass(selectedCurrentClass, selectedNewClass);
    
    let message = `All ${studentsInClass.length} students from ${selectedCurrentClass} have been promoted to ${selectedNewClass}`;
    if (totalArrears > 0) {
      message += `. Total arrears of GHS ${totalArrears.toLocaleString()} have been carried forward.`;
    }

    toast({
      title: "Class Promoted Successfully",
      description: message,
    });

    // Reset form
    setSelectedCurrentClass('');
    setSelectedNewClass('');
    setShowFeeWarning(false);
    setFeeImpactData(null);
  };

  const getStudentsInClass = (className: string) => {
    return students.filter(s => s.classAssigned === className);
  };

  const getStudentWithFeeInfo = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;

    const feeCalc = calculateStudentFeesSync(
      studentId,
      currentTerm,
      student.classAssigned,
      feeStructures,
      payments,
      student.classAssignedId,
      null,
      {
        isBeneficiary: !!student.isBeneficiary,
        discountType: student.discountType,
        discountValue: student.discountValue
      }
    );

    const outstandingBalance = Math.max(0, feeCalc.totalAmountDue - feeCalc.totalPaid);

    return {
      ...student,
      outstandingBalance,
      hasOutstanding: outstandingBalance > 0
    };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Fee Warning Dialog */}
      {showFeeWarning && feeImpactData && (
        <Card className="border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-500/10 rounded-[2rem] overflow-hidden shadow-2xl border-2">
          <CardHeader className="bg-orange-100/50 dark:bg-orange-500/10 border-b border-orange-200/50 dark:border-orange-800/50 px-8 py-6">
            <CardTitle className="flex items-center gap-3 text-lg font-semibold text-orange-950 dark:text-orange-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              Fees reminder before promotion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {promotionType === 'individual' ? (
              <div className="space-y-6">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  <span className="font-semibold">{feeImpactData.studentName}</span> still has school fees that are not fully
                  paid:
                </p>
                <div className="rounded-[1.5rem] border border-orange-200 bg-white p-6 shadow-inner dark:border-orange-800/50 dark:bg-slate-900/50">
                  <div className="grid grid-cols-2 gap-6 text-sm md:grid-cols-3">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">Class now</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{feeImpactData.currentClass}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">Moving to</p>
                      <p className="font-semibold text-slate-900 dark:text-white">{feeImpactData.newClass}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-red-600">Still to pay</p>
                      <p className="text-lg font-semibold tabular-nums text-red-600 dark:text-red-400">
                        GHS {feeImpactData.outstandingBalance.toLocaleString()}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">Paid so far</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">GHS {feeImpactData.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-slate-500">Older fees owed</p>
                      <p className="font-semibold text-slate-900 dark:text-white">GHS {feeImpactData.arrears.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-orange-200/60 bg-orange-500/5 p-4 text-sm text-orange-900 dark:text-orange-100">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  <span>
                    The amount still owed will be kept on the student&apos;s account for the new class (arrears), so you can
                    collect it later.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                  <span className="font-semibold">{feeImpactData.studentsWithOutstanding}</span> of{' '}
                  {feeImpactData.totalStudents} students in this class still owe fees:
                </p>
                <div className="rounded-[1.5rem] border border-orange-200 bg-white p-6 shadow-inner dark:border-orange-800/50 dark:bg-slate-900/50">
                  <div className="mb-6 flex items-center justify-between border-b border-orange-100 pb-6 dark:border-orange-800/50">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total still owed</span>
                    <span className="text-2xl font-semibold tabular-nums text-red-600 dark:text-red-400">
                      GHS {feeImpactData.totalOutstandingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {feeImpactData.studentDetails
                      .filter((s: any) => s.willBecomeArrears)
                      .map((student: any) => (
                        <div
                          key={student.studentId}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm dark:border-slate-700/50 dark:bg-slate-800/50"
                        >
                          <span className="font-medium text-slate-900 dark:text-white">{student.studentName}</span>
                          <span className="tabular-nums font-semibold text-red-600 dark:text-red-400">
                            GHS {student.outstandingBalance.toLocaleString()}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-orange-200/60 bg-orange-500/5 p-4 text-sm text-orange-900 dark:text-orange-100">
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-500" />
                  <span>Those balances stay on each student&apos;s account after promotion so you can follow up for payment.</span>
                </div>
              </div>
            )}
            <div className="mt-8 flex flex-col gap-3 border-t border-orange-200/50 pt-6 dark:border-orange-800/50 sm:flex-row">
              <Button
                onClick={promotionType === 'individual' ? executeIndividualPromotion : executeClassPromotion}
                className="h-11 rounded-xl bg-orange-600 px-8 text-sm font-semibold text-white shadow-lg hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-400"
              >
                Yes, promote anyway
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeeWarning(false);
                  setFeeImpactData(null);
                }}
                className="h-11 rounded-xl border-slate-200 px-8 text-sm font-medium dark:border-slate-700"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main promote form */}
      <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900/50">
        <CardHeader className="border-b border-slate-200/50 bg-slate-50/50 px-8 py-6 dark:border-slate-800/50 dark:bg-slate-800/30">
          <CardTitle className="flex flex-wrap items-center gap-3 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10">
              <TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Promote students
            <Badge variant="outline" className="ml-0 text-xs font-medium border-indigo-500/20 bg-indigo-500/5 text-indigo-700 dark:text-indigo-300">
              Term: {currentTerm}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="mb-10 flex flex-wrap gap-3">
            <Button
              variant={promotionType === 'individual' ? 'default' : 'outline'}
              onClick={() => setPromotionType('individual')}
              className={`flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-medium transition-all ${
                promotionType === 'individual'
                  ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <User className="h-4 w-4" />
              One student
            </Button>
            <Button
              variant={promotionType === 'class' ? 'default' : 'outline'}
              onClick={() => setPromotionType('class')}
              className={`flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-medium transition-all ${
                promotionType === 'class'
                  ? 'bg-slate-900 text-white shadow-lg dark:bg-white dark:text-slate-900'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <Users className="h-4 w-4" />
              Whole class
            </Button>
          </div>

          {promotionType === 'individual' ? (
            <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <Label className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-300">Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-medium dark:border-slate-700 dark:bg-slate-800/50">
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {students.map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <SelectItem key={student.id} value={student.id} className="rounded-xl p-3">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">
                                {student.firstName} {student.lastName}
                              </span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-medium">
                                  {student.classAssigned}
                                </Badge>
                                {studentWithFee?.hasOutstanding && (
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-300">New class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-medium dark:border-slate-700 dark:bg-slate-800/50">
                      <SelectValue placeholder="Pick the new class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className} className="rounded-xl">
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedStudent && (
                <div className="bg-indigo-500/5 dark:bg-indigo-500/10 p-6 rounded-[2rem] border border-indigo-500/20 shadow-inner flex items-center gap-6">
                  {(() => {
                    const studentWithFee = getStudentWithFeeInfo(selectedStudent);
                    return (
                      <>
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 text-xl font-semibold text-indigo-700 dark:text-indigo-300">
                          {studentWithFee?.firstName?.[0]}
                          {studentWithFee?.lastName?.[0]}
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-base font-semibold text-slate-900 dark:text-white">
                            {studentWithFee?.firstName} {studentWithFee?.lastName}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs font-medium border-indigo-500/30 text-indigo-700 dark:text-indigo-300">
                              Class now: {studentWithFee?.classAssigned}
                            </Badge>
                            {studentWithFee?.hasOutstanding && (
                              <Badge variant="outline" className="border-red-500/30 bg-red-500/5 text-xs font-medium text-red-700 dark:text-red-300">
                                Owes GHS {studentWithFee.outstandingBalance.toLocaleString()}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleIndividualPromotion}
                  className="h-11 rounded-xl bg-slate-900 px-10 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
                >
                  Promote student
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <Label className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-300">Class to move from</Label>
                  <Select value={selectedCurrentClass} onValueChange={setSelectedCurrentClass}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-medium dark:border-slate-700 dark:bg-slate-800/50">
                      <SelectValue placeholder="Choose current class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {classes.map((cls) => {
                        const studentsInClass = getStudentsInClass(cls.className);
                        const studentsWithOutstanding = studentsInClass.filter(s => {
                          const studentWithFee = getStudentWithFeeInfo(s.id);
                          return studentWithFee?.hasOutstanding;
                        }).length;
                        
                        return (
                          <SelectItem key={cls.id} value={cls.className} className="rounded-xl p-3">
                            <div className="flex items-center justify-between w-full">
                              <span className="text-sm font-medium text-slate-900 dark:text-white">{cls.className}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs font-medium">
                                  {studentsInClass.length} students
                                </Badge>
                                {studentsWithOutstanding > 0 && (
                                  <div className="flex items-center gap-1 text-red-500 text-[10px] font-black">
                                    <AlertTriangle className="w-3 h-3" />
                                    {studentsWithOutstanding}
                                  </div>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2.5">
                  <Label className="ml-1 text-sm font-medium text-slate-700 dark:text-slate-300">New class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50 font-medium dark:border-slate-700 dark:bg-slate-800/50">
                      <SelectValue placeholder="Choose new class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className} className="rounded-xl">
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCurrentClass && (
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-8 rounded-[2rem] border border-emerald-500/20 shadow-inner space-y-6">
                  <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-300">Students in {selectedCurrentClass}</p>
                    <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                      {getStudentsInClass(selectedCurrentClass).length} students
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {getStudentsInClass(selectedCurrentClass).map((student) => {
                      const studentWithFee = getStudentWithFeeInfo(student.id);
                      return (
                        <Badge 
                          key={student.id} 
                          variant="outline" 
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                            studentWithFee?.hasOutstanding 
                            ? 'border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400' 
                            : 'border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {student.firstName} {student.lastName}
                          {studentWithFee?.hasOutstanding && (
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 ml-2 animate-pulse" />
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleClassPromotion}
                  className="h-11 rounded-xl bg-slate-900 px-10 text-sm font-semibold text-white shadow-lg transition-opacity hover:opacity-90 dark:bg-white dark:text-slate-900"
                >
                  Promote whole class
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registry Overview */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-6">
          <CardTitle className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Students by class</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {classes.map((cls) => {
              const studentsInClass = getStudentsInClass(cls.className);
              const studentsWithOutstanding = studentsInClass.filter(s => {
                const studentWithFee = getStudentWithFeeInfo(s.id);
                return studentWithFee?.hasOutstanding;
              });
              
              return (
                <div key={cls.id} className="p-6 bg-slate-50/50 dark:bg-slate-800/20 rounded-[1.5rem] border border-slate-200 dark:border-slate-700/50 hover:border-indigo-500/30 transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-slate-900 transition-colors group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
                        {cls.className}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{cls.level}</p>
                    </div>
                    {studentsWithOutstanding.length > 0 && (
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge variant="outline" className="border-slate-200 bg-white text-xs font-medium dark:border-slate-800 dark:bg-slate-950">
                      {studentsInClass.length} students
                    </Badge>
                    {studentsWithOutstanding.length > 0 && (
                      <Badge variant="destructive" className="border-0 bg-red-500 text-xs font-medium text-white">
                        {studentsWithOutstanding.length} with balance
                      </Badge>
                    )}
                  </div>

                  {studentsInClass.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                      {studentsInClass.slice(0, 3).map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <div key={student.id} className="flex items-center justify-between text-[10px]">
                            <p className="mr-4 truncate text-xs font-medium text-slate-600 dark:text-slate-400">
                              {student.firstName} {student.lastName}
                            </p>
                            {studentWithFee?.hasOutstanding && (
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                      {studentsInClass.length > 3 && (
                        <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
                          + {studentsInClass.length - 3} more students
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PromoteStudents;
