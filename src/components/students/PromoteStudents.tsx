
import React, { useState } from 'react';
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

const PromoteStudents = () => {
  const { students, classes, promoteStudent, promoteClass, feeStructures, payments } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const [promotionType, setPromotionType] = useState<'individual' | 'class'>('individual');
  const [selectedStudent, setSelectedStudent] = useState('');
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
      payments
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
        <Card className="border-orange-200 dark:border-orange-800/50 bg-orange-50/50 dark:bg-orange-500/10 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-2xl border-2">
          <CardHeader className="bg-orange-100/50 dark:bg-orange-500/10 border-b border-orange-200/50 dark:border-orange-800/50 px-8 py-6">
            <CardTitle className="flex items-center gap-3 text-orange-900 dark:text-orange-400 font-black font-outfit tracking-tight">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              Financial Protocol Warning
            </CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            {promotionType === 'individual' ? (
              <div className="space-y-6">
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">
                  Outstanding balance detected for <span className="text-orange-950 dark:text-white font-black underline decoration-orange-500/50 underline-offset-4">{feeImpactData.studentName}</span>:
                </p>
                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[1.5rem] border border-orange-200 dark:border-orange-800/50 shadow-inner">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-[11px]">
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Current Class</p>
                      <p className="font-bold text-slate-900 dark:text-white">{feeImpactData.currentClass}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Target Class</p>
                      <p className="font-bold text-slate-900 dark:text-white">{feeImpactData.newClass}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-red-500 uppercase tracking-widest">Balance Due</p>
                      <p className="font-black text-red-600 dark:text-red-400 text-lg">GHS {feeImpactData.outstandingBalance.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Paid to Date</p>
                      <p className="font-bold text-emerald-600 dark:text-emerald-400">GHS {feeImpactData.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="font-black text-slate-400 uppercase tracking-widest">Legacy Arrears</p>
                      <p className="font-bold text-slate-900 dark:text-white">GHS {feeImpactData.arrears.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-[0.2em] bg-orange-500/5 p-4 rounded-xl border border-orange-200/30">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Carry-forward protocol: Balance will be added to the target class arrears account.
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-sm font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">
                  <span className="text-orange-950 dark:text-white font-black">{feeImpactData.studentsWithOutstanding} units</span> exhibit financial deficits in this batch promotion:
                </p>
                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[1.5rem] border border-orange-200 dark:border-orange-800/50 shadow-inner">
                  <div className="flex items-center justify-between mb-6 pb-6 border-b border-orange-100 dark:border-orange-800/50">
                    <span className="font-black text-slate-400 uppercase tracking-widest text-[11px]">Total Deficit Exposure:</span>
                    <span className="text-red-600 dark:text-red-400 font-black text-2xl font-outfit">
                      GHS {feeImpactData.totalOutstandingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {feeImpactData.studentDetails
                      .filter((s: any) => s.willBecomeArrears)
                      .map((student: any) => (
                        <div key={student.studentId} className="flex justify-between items-center text-[11px] bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50">
                          <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider">{student.studentName}</span>
                          <span className="text-red-600 dark:text-red-400 font-black tracking-widest">GHS {student.outstandingBalance.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-[0.2em] bg-orange-500/5 p-4 rounded-xl border border-orange-200/30">
                  <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  Mass Migration Policy: All deficits will persist across the institutional transition.
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-6 border-t border-orange-200/50 dark:border-orange-800/50">
              <Button 
                onClick={promotionType === 'individual' ? executeIndividualPromotion : executeClassPromotion}
                className="h-14 px-8 bg-orange-600 dark:bg-orange-500 text-white hover:bg-orange-700 dark:hover:bg-orange-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-orange-600/20"
              >
                Authorize Promotion
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowFeeWarning(false);
                  setFeeImpactData(null);
                }}
                className="h-14 px-8 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                Abort Protocol
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotion Engine */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-6">
          <CardTitle className="flex items-center gap-3 text-slate-900 dark:text-white font-black font-outfit text-xl tracking-tight">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            Institutional Promotion Engine
            <Badge variant="outline" className="ml-2 text-[10px] font-black uppercase tracking-widest border-indigo-500/20 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5">
              Cycle: {currentTerm}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex flex-wrap gap-4 mb-10">
            <Button
              variant={promotionType === 'individual' ? 'default' : 'outline'}
              onClick={() => setPromotionType('individual')}
              className={`h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${
                promotionType === 'individual' 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/10' 
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <User className="w-4 h-4" />
              Individual Token
            </Button>
            <Button
              variant={promotionType === 'class' ? 'default' : 'outline'}
              onClick={() => setPromotionType('class')}
              className={`h-14 px-8 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center gap-3 ${
                promotionType === 'class' 
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-slate-900/20 dark:shadow-white/10' 
                : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
              }`}
            >
              <Users className="w-4 h-4" />
              Class Batch
            </Button>
          </div>

          {promotionType === 'individual' ? (
            <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Identity Selection</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger className="h-14 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-2xl font-medium">
                      <SelectValue placeholder="Choose target identity" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {students.map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <SelectItem key={student.id} value={student.id} className="rounded-xl p-3">
                            <div className="flex items-center justify-between w-full">
                              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">{student.firstName} {student.lastName}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] font-black">{student.classAssigned}</Badge>
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
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Migration Target</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger className="h-14 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-2xl font-medium">
                      <SelectValue placeholder="Assign new Level" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className} className="rounded-xl">
                          {cls.className.toUpperCase()}
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
                        <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/20 flex items-center justify-center font-black text-indigo-600 text-xl font-outfit uppercase">
                          {studentWithFee?.firstName?.[0]}{studentWithFee?.lastName?.[0]}
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-black text-slate-900 dark:text-white font-outfit tracking-tight uppercase">
                            {studentWithFee?.firstName} {studentWithFee?.lastName}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                              Current: {studentWithFee?.classAssigned}
                            </Badge>
                            {studentWithFee?.hasOutstanding && (
                              <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5">
                                DEFICIT: GHS {studentWithFee.outstandingBalance.toLocaleString()}
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
                <Button onClick={handleIndividualPromotion} className="h-14 px-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95">
                  Execute Migration
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2.5">
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Current Sector</Label>
                  <Select value={selectedCurrentClass} onValueChange={setSelectedCurrentClass}>
                    <SelectTrigger className="h-14 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-2xl font-medium">
                      <SelectValue placeholder="Select origin class" />
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
                              <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">{cls.className}</span>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] font-black">{studentsInClass.length} UNITS</Badge>
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
                  <Label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider ml-1">Institutional Target</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger className="h-14 bg-slate-50/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-2xl font-medium">
                      <SelectValue placeholder="Select target class" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl">
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className} className="rounded-xl">
                          {cls.className.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCurrentClass && (
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 p-8 rounded-[2rem] border border-emerald-500/20 shadow-inner space-y-6">
                  <div className="flex items-center justify-between border-b border-emerald-500/10 pb-4">
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-400 font-outfit uppercase tracking-wider">
                      Migration Manifest: {selectedCurrentClass}
                    </p>
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-black uppercase tracking-widest text-[9px]">
                      {getStudentsInClass(selectedCurrentClass).length} Units Detected
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                    {getStudentsInClass(selectedCurrentClass).map((student) => {
                      const studentWithFee = getStudentWithFeeInfo(student.id);
                      return (
                        <Badge 
                          key={student.id} 
                          variant="outline" 
                          className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
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
                <Button onClick={handleClassPromotion} className="h-14 px-12 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-2xl transition-all hover:scale-105 active:scale-95">
                  Execute Batch Migration
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Registry Overview */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-6">
          <CardTitle className="text-xl font-black text-slate-900 dark:text-white font-outfit tracking-tight">Institutional Registry Status</CardTitle>
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
                      <h3 className="font-black text-slate-900 dark:text-white font-outfit tracking-tight uppercase text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{cls.className}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{cls.level}</p>
                    </div>
                    {studentsWithOutstanding.length > 0 && (
                      <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-6">
                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
                      {studentsInClass.length} UNITS
                    </Badge>
                    {studentsWithOutstanding.length > 0 && (
                      <Badge variant="destructive" className="text-[9px] font-black uppercase tracking-widest bg-red-500 text-white border-0">
                        {studentsWithOutstanding.length} DEFICITS
                      </Badge>
                    )}
                  </div>

                  {studentsInClass.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                      {studentsInClass.slice(0, 3).map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <div key={student.id} className="flex items-center justify-between text-[10px]">
                            <p className="font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider truncate mr-4">
                              {student.firstName} {student.lastName}
                            </p>
                            {studentWithFee?.hasOutstanding && (
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </div>
                        );
                      })}
                      {studentsInClass.length > 3 && (
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] pt-1">
                          + {studentsInClass.length - 3} OTHERS IN INDEX
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
