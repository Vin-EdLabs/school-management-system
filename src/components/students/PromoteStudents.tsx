
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

  const handleClassPromotion = () => {
    if (!selectedCurrentClass || !selectedNewClass) {
      toast({
        title: "Validation Error",
        description: "Please select both current class and new class",
        variant: "destructive"
      });
      return;
    }

    const feeImpact = calculateClassFeeImpact(selectedCurrentClass, selectedNewClass);
    
    if (feeImpact.studentsWithOutstanding > 0) {
      setFeeImpactData(feeImpact);
      setShowFeeWarning(true);
    } else {
      executeClassPromotion();
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

    const feeCalc = calculateStudentFees(
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
    <div className="space-y-6">
      {/* Fee Warning Dialog */}
      {showFeeWarning && feeImpactData && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-orange-800">
              <AlertTriangle className="w-5 h-5" />
              <span>Fee Impact Warning</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {promotionType === 'individual' ? (
              <div className="space-y-4">
                <p className="text-orange-800">
                  <strong>{feeImpactData.studentName}</strong> has an outstanding balance that will become arrears:
                </p>
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Current Class:</p>
                      <p>{feeImpactData.currentClass}</p>
                    </div>
                    <div>
                      <p className="font-medium">New Class:</p>
                      <p>{feeImpactData.newClass}</p>
                    </div>
                    <div>
                      <p className="font-medium">Term Fee:</p>
                      <p>GHS {feeImpactData.currentTermFee.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-medium">Amount Paid:</p>
                      <p>GHS {feeImpactData.totalPaid.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-medium text-red-600">Outstanding Balance:</p>
                      <p className="text-red-600 font-bold">GHS {feeImpactData.outstandingBalance.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="font-medium">Existing Arrears:</p>
                      <p>GHS {feeImpactData.arrears.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-orange-700">
                  The outstanding balance will be automatically added to the student's arrears in the new class.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-orange-800">
                  <strong>{feeImpactData.studentsWithOutstanding} out of {feeImpactData.totalStudents} students</strong> have outstanding balances:
                </p>
                <div className="bg-white p-4 rounded-lg border border-orange-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium">Total Outstanding Amount:</span>
                    <span className="text-red-600 font-bold text-lg">
                      GHS {feeImpactData.totalOutstandingAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {feeImpactData.studentDetails
                      .filter((s: any) => s.willBecomeArrears)
                      .map((student: any) => (
                        <div key={student.studentId} className="flex justify-between text-sm">
                          <span>{student.studentName}</span>
                          <span className="text-red-600">GHS {student.outstandingBalance.toLocaleString()}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <p className="text-sm text-orange-700">
                  All outstanding balances will be automatically carried forward as arrears.
                </p>
              </div>
            )}
            <div className="flex space-x-4 mt-6">
              <Button 
                onClick={promotionType === 'individual' ? executeIndividualPromotion : executeClassPromotion}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Proceed with Promotion
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowFeeWarning(false);
                  setFeeImpactData(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Promotion Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5" />
            <span>Student Promotion - {currentTerm}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4 mb-6">
            <Button
              variant={promotionType === 'individual' ? 'default' : 'outline'}
              onClick={() => setPromotionType('individual')}
              className="flex items-center space-x-2"
            >
              <User className="w-4 h-4" />
              <span>Individual Student</span>
            </Button>
            <Button
              variant={promotionType === 'class' ? 'default' : 'outline'}
              onClick={() => setPromotionType('class')}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Entire Class</span>
            </Button>
          </div>

          {promotionType === 'individual' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Student</Label>
                  <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a student" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <SelectItem key={student.id} value={student.id}>
                            <div className="flex items-center justify-between w-full">
                              <span>{student.firstName} {student.lastName} - {student.classAssigned}</span>
                              {studentWithFee?.hasOutstanding && (
                                <DollarSign className="w-4 h-4 text-red-500 ml-2" />
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Promote to Class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {selectedStudent && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  {(() => {
                    const studentWithFee = getStudentWithFeeInfo(selectedStudent);
                    return (
                      <div>
                        <p className="text-sm text-blue-800">
                          <strong>Selected Student:</strong> {studentWithFee?.firstName} {studentWithFee?.lastName}
                        </p>
                        <p className="text-sm text-blue-600">
                          Current Class: {studentWithFee?.classAssigned}
                        </p>
                        {studentWithFee?.hasOutstanding && (
                          <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-200">
                            <p className="text-sm text-orange-800 flex items-center">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              Outstanding Balance: GHS {studentWithFee.outstandingBalance.toLocaleString()}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <Button onClick={handleIndividualPromotion} className="w-full md:w-auto">
                Promote Student
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Current Class</Label>
                  <Select value={selectedCurrentClass} onValueChange={setSelectedCurrentClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select current class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => {
                        const studentsInClass = getStudentsInClass(cls.className);
                        const studentsWithOutstanding = studentsInClass.filter(s => {
                          const studentWithFee = getStudentWithFeeInfo(s.id);
                          return studentWithFee?.hasOutstanding;
                        }).length;
                        
                        return (
                          <SelectItem key={cls.id} value={cls.className}>
                            <div className="flex items-center justify-between w-full">
                              <span>{cls.className} ({studentsInClass.length} students)</span>
                              {studentsWithOutstanding > 0 && (
                                <div className="flex items-center ml-2">
                                  <DollarSign className="w-4 h-4 text-red-500" />
                                  <span className="text-xs text-red-500 ml-1">{studentsWithOutstanding}</span>
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Promote to Class</Label>
                  <Select value={selectedNewClass} onValueChange={setSelectedNewClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select new class" />
                    </SelectTrigger>
                    <SelectContent>
                      {classes.map((cls) => (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedCurrentClass && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-800 mb-2">
                    <strong>Students to be promoted from {selectedCurrentClass}:</strong>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {getStudentsInClass(selectedCurrentClass).map((student) => {
                      const studentWithFee = getStudentWithFeeInfo(student.id);
                      return (
                        <Badge 
                          key={student.id} 
                          variant="outline" 
                          className={`text-green-700 ${
                            studentWithFee?.hasOutstanding ? 'border-orange-300 bg-orange-50' : ''
                          }`}
                        >
                          {student.firstName} {student.lastName}
                          {studentWithFee?.hasOutstanding && (
                            <DollarSign className="w-3 h-3 ml-1 text-orange-500" />
                          )}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-sm text-green-600 mt-2">
                    Total: {getStudentsInClass(selectedCurrentClass).length} students
                  </p>
                  {(() => {
                    const studentsWithOutstanding = getStudentsInClass(selectedCurrentClass).filter(s => {
                      const studentWithFee = getStudentWithFeeInfo(s.id);
                      return studentWithFee?.hasOutstanding;
                    });
                    
                    if (studentsWithOutstanding.length > 0) {
                      return (
                        <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-200">
                          <p className="text-sm text-orange-800 flex items-center">
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            {studentsWithOutstanding.length} student(s) have outstanding balances
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}

              <Button onClick={handleClassPromotion} className="w-full md:w-auto">
                Promote Entire Class
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Class Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Class Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {classes.map((cls) => {
              const studentsInClass = getStudentsInClass(cls.className);
              const studentsWithOutstanding = studentsInClass.filter(s => {
                const studentWithFee = getStudentWithFeeInfo(s.id);
                return studentWithFee?.hasOutstanding;
              });
              
              return (
                <div key={cls.id} className="p-4 border rounded-lg">
                  <h3 className="font-semibold text-lg">{cls.className}</h3>
                  <p className="text-sm text-gray-600">{cls.level}</p>
                  <div className="mt-2 flex items-center space-x-2">
                    <Badge variant="outline">
                      {studentsInClass.length} students
                    </Badge>
                    {studentsWithOutstanding.length > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {studentsWithOutstanding.length} owing fees
                      </Badge>
                    )}
                  </div>
                  {studentsInClass.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {studentsInClass.slice(0, 3).map((student) => {
                        const studentWithFee = getStudentWithFeeInfo(student.id);
                        return (
                          <div key={student.id} className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">
                              {student.firstName} {student.lastName}
                            </p>
                            {studentWithFee?.hasOutstanding && (
                              <DollarSign className="w-3 h-3 text-red-500" />
                            )}
                          </div>
                        );
                      })}
                      {studentsInClass.length > 3 && (
                        <p className="text-xs text-gray-400">
                          +{studentsInClass.length - 3} more...
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
