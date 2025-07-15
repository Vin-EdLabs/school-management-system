
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { AlertCircle, Users, DollarSign } from 'lucide-react';

const OutstandingFees = () => {
  const { students, payments, feeStructures, classes } = useData();
  const [selectedClass, setSelectedClass] = useState('all-classes');
  const [academicSettings, setAcademicSettings] = useState({
    currentTerm: 'Term 1 2024'
  });

  // Load academic settings
  useEffect(() => {
    const savedSettings = localStorage.getItem('academicSettings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setAcademicSettings(settings);
      } catch (error) {
        console.error('Error loading academic settings:', error);
      }
    }
  }, []);

  // Calculate outstanding balance for each student
  const calculateOutstandingBalance = (student: any) => {
    const studentFee = feeStructures.find(fee => fee.className === student.classAssigned);
    if (!studentFee) return 0;

    const studentPayments = payments
      .filter(payment => payment.studentId === student.id && payment.term === academicSettings.currentTerm)
      .reduce((sum, payment) => sum + payment.amount, 0);

    return Math.max(0, studentFee.amount - studentPayments);
  };

  // Get students with outstanding balances
  const studentsWithOutstanding = students
    .map(student => ({
      ...student,
      outstandingBalance: calculateOutstandingBalance(student)
    }))
    .filter(student => student.outstandingBalance > 0);

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

  // Calculate totals
  const totalOutstanding = filteredStudents.reduce((sum, student) => sum + student.outstandingBalance, 0);
  const totalStudentsOwing = filteredStudents.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <span>Outstanding Fees</span>
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
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Users className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">Students Owing</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{totalStudentsOwing}</div>
            </div>
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <DollarSign className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-800">Total Outstanding</span>
              </div>
              <div className="text-2xl font-bold text-orange-600">
                GHS {totalOutstanding.toLocaleString()}
              </div>
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
                      </div>
                    </div>
                    <div className="space-y-3">
                      {classStudents
                        .sort((a, b) => b.outstandingBalance - a.outstandingBalance)
                        .map((student) => (
                          <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div>
                              <div className="font-medium text-gray-800">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {student.studentId}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-red-600">
                                GHS {student.outstandingBalance.toLocaleString()}
                              </div>
                              <div className="text-xs text-gray-500">
                                Outstanding
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OutstandingFees;
