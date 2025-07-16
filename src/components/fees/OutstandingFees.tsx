
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { AlertCircle, Users, DollarSign, CreditCard, TrendingUp } from 'lucide-react';
import { getActiveAcademicTerm, calculateStudentFees, calculateStudentFeeStatus } from '../../utils/feeCalculations';

const OutstandingFees = () => {
  const { students, payments, feeStructures, classes } = useData();
  const [selectedClass, setSelectedClass] = useState('all-classes');
  const [currentTerm, setCurrentTerm] = useState(getActiveAcademicTerm());

  // Calculate comprehensive outstanding balance for each student
  const calculateStudentOutstanding = (student: any) => {
    const feeCalculation = calculateStudentFees(
      student.id,
      currentTerm,
      student.classAssigned,
      feeStructures,
      payments
    );
    
    const feeStatus = calculateStudentFeeStatus(
      student.id,
      currentTerm,
      students,
      feeStructures,
      payments
    );

    return {
      ...student,
      currentTermFee: feeCalculation.currentTermFee,
      arrears: feeCalculation.arrears,
      creditBalance: feeCalculation.creditBalance,
      totalAmountDue: feeCalculation.totalAmountDue,
      totalPaid: feeCalculation.totalPaid,
      outstandingBalance: Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid),
      feeStatus: feeStatus,
      paymentHistory: payments.filter(p => p.studentId === student.id)
    };
  };

  // Get students with outstanding balances
  const studentsWithDetails = students.map(calculateStudentOutstanding);
  const studentsWithOutstanding = studentsWithDetails.filter(student => student.outstandingBalance > 0);

  // Filter by class if selected
  const filteredStudents = selectedClass === 'all-classes' 
    ? studentsWithOutstanding 
    : studentsWithOutstanding.filter(student => student.classAssigned === selectedClass);

  // Group students by class
  const studentsByClass = filteredStudents.reduce((acc, student) => {
    const className = student.classAssigned;
    if (!acc[className]) {
      acc[className] = [];
    }
    acc[className].push(student);
    return acc;
  }, {} as Record<string, any[]>);

  // Calculate comprehensive totals
  const totalOutstanding = filteredStudents.reduce((sum, student) => sum + student.outstandingBalance, 0);
  const totalArrears = filteredStudents.reduce((sum, student) => sum + student.arrears, 0);
  const totalCurrentTermFees = filteredStudents.reduce((sum, student) => sum + student.currentTermFee, 0);
  const totalStudentsOwing = filteredStudents.length;

  // Calculate statistics
  const studentsWithArrears = filteredStudents.filter(s => s.arrears > 0).length;
  const studentsWithCurrentTermOwing = filteredStudents.filter(s => 
    s.outstandingBalance > 0 && s.totalPaid < s.currentTermFee
  ).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Outstanding Fees Analysis</span>
            </CardTitle>
            <div className="flex items-center space-x-4">
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by class" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-classes">All Classes</SelectItem>
                  {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                    <SelectItem key={cls.id} value={cls.className}>
                      {cls.className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Students Owing</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{totalStudentsOwing}</div>
              <div className="text-xs text-red-600 mt-1">
                {studentsWithArrears} with arrears
              </div>
            </div>
            
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Total Outstanding</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                GHS {totalOutstanding.toLocaleString()}
              </div>
              <div className="text-xs text-orange-600 mt-1">
                Current term: GHS {(totalOutstanding - totalArrears).toLocaleString()}
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">Arrears</span>
              </div>
              <div className="text-2xl font-bold text-amber-600">
                GHS {totalArrears.toLocaleString()}
              </div>
              <div className="text-xs text-amber-600 mt-1">
                From previous terms
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Expected This Term</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">
                GHS {totalCurrentTermFees.toLocaleString()}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                From {totalStudentsOwing} students
              </div>
            </div>
          </div>

          {/* Term Information */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold text-gray-800 mb-2">Current Academic Period</h3>
            <div className="text-sm text-gray-600">
              <p><strong>Term:</strong> {currentTerm}</p>
              <p><strong>Report Date:</strong> {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Students by Class */}
          {Object.keys(studentsByClass).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium mb-2">No Outstanding Fees</h3>
              <p>All students in the selected class(es) have paid their fees in full.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(studentsByClass)
                .sort(([classA], [classB]) => classA.localeCompare(classB))
                .map(([className, classStudents]) => (
                  <div key={className} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">{className}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">
                          {classStudents.length} student{classStudents.length !== 1 ? 's' : ''}
                        </Badge>
                        <Badge variant="destructive">
                          GHS {classStudents.reduce((sum, s) => sum + s.outstandingBalance, 0).toLocaleString()}
                        </Badge>
                        {classStudents.some(s => s.arrears > 0) && (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            Arrears: GHS {classStudents.reduce((sum, s) => sum + s.arrears, 0).toLocaleString()}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-3">
                      {classStudents
                        .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
                        .map((student) => (
                          <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {student.studentId}
                              </div>
                              <div className="text-xs text-gray-400 mt-1">
                                {student.paymentHistory.length} payment{student.paymentHistory.length !== 1 ? 's' : ''} recorded
                              </div>
                            </div>
                            <div className="text-right space-y-1">
                              <div className="font-bold text-red-600">
                                GHS {student.outstandingBalance.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                Term Fee: GHS {student.currentTermFee.toLocaleString()}
                              </div>
                              {student.arrears > 0 && (
                                <div className="text-xs text-amber-600">
                                  Arrears: GHS {student.arrears.toLocaleString()}
                                </div>
                              )}
                              <div className="text-xs text-green-600">
                                Paid: GHS {student.totalPaid.toLocaleString()}
                              </div>
                              {student.creditBalance > 0 && (
                                <div className="text-xs text-blue-600">
                                  Credit: GHS {student.creditBalance.toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Summary Footer */}
          {filteredStudents.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-medium text-blue-800">Collection Summary</p>
                  <p className="text-blue-600">
                    {totalStudentsOwing} students owe a total of GHS {totalOutstanding.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-800">Arrears Impact</p>
                  <p className="text-blue-600">
                    GHS {totalArrears.toLocaleString()} carried forward from previous terms
                  </p>
                </div>
                <div>
                  <p className="font-medium text-blue-800">Current Term</p>
                  <p className="text-blue-600">
                    GHS {(totalOutstanding - totalArrears).toLocaleString()} from current term fees
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OutstandingFees;
