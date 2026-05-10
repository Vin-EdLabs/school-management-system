
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { Users, GraduationCap, BookOpen, DollarSign, AlertCircle, Eye } from 'lucide-react';
import { calculateStudentFeesSync, calculateStudentFeeStatusSync } from '../../utils/feeCalculations';

/** Map sync fee status to labels this dashboard already renders */
function feeStatusForDashboard(sync: ReturnType<typeof calculateStudentFeeStatusSync>) {
  if (sync.status === 'Paid') return { status: 'Fully Paid' as const, balance: 0 };
  if (sync.status === 'Credit Balance') return { status: 'Credit Balance' as const, balance: sync.balance };
  if (sync.status === 'No Fee Set') return { status: 'No Fee Set' as const, balance: 0 };
  return { status: 'Amount Owing' as const, balance: sync.balance };
}

const AdministratorDashboard = () => {
  const { students, teachers, classes, payments, feeStructures, arrearsBalances } = useData();
  const { currentTerm: activeAcademicTerm, currentYear: activeAcademicYear } = useActiveTerm();
  const [selectedClass, setSelectedClass] = useState('all-classes');

  // Calculate real-time student statistics
  const totalStudents = students.length;
  const maleStudents = students.filter(s => s.gender === 'Male').length;
  const femaleStudents = students.filter(s => s.gender === 'Female').length;

  // Calculate real-time teacher statistics
  const totalTeachers = teachers.length;
  const maleTeachers = teachers.filter(t => t.gender === 'Male').length;
  const femaleTeachers = teachers.filter(t => t.gender === 'Female').length;

  // Calculate active classes count
  const activeClasses = classes.filter(cls => cls.className && cls.className.trim() !== '').length;

  const filteredStudents = useMemo(
    () =>
      selectedClass === 'all-classes'
        ? students
        : students.filter((student) => student.classAssigned === selectedClass),
    [students, selectedClass]
  );

  const studentsWithFeeStatus = useMemo(() => {
    const term = activeAcademicTerm?.trim() || '';
    if (!term || term === 'Not Set') {
      return filteredStudents.map((student) => ({
        ...student,
        feeStatus: { status: 'No Fee Set' as const, balance: 0 },
      }));
    }
    return filteredStudents.map((student) => {
      const feeCalc = calculateStudentFeesSync(
        student.id,
        term,
        student.classAssigned,
        feeStructures,
        payments,
        student.classAssignedId,
        arrearsBalances,
        {
          isBeneficiary: !!student.isBeneficiary,
          discountType: student.discountType,
          discountValue: student.discountValue,
        }
      );
      const sync = calculateStudentFeeStatusSync(feeCalc);
      return { ...student, feeStatus: feeStatusForDashboard(sync) };
    });
  }, [filteredStudents, activeAcademicTerm, feeStructures, payments, arrearsBalances]);

  // Calculate real-time fee overview totals
  const totalOwing = studentsWithFeeStatus
    .filter(s => s.feeStatus.status === 'Amount Owing')
    .reduce((sum, s) => sum + s.feeStatus.balance, 0);

  const fullyPaidCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'Fully Paid').length;
  const owingCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'Amount Owing').length;
  const noFeeSetCount = studentsWithFeeStatus.filter(s => s.feeStatus.status === 'No Fee Set').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
            <p className="text-gray-600">Academic Year: {activeAcademicYear} | {activeAcademicTerm}</p>
          </div>
        </div>
      </div>

      {/* Overview Cards with Real Data */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {maleStudents} Male • {femaleStudents} Female
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <BookOpen className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeachers}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {maleTeachers} Male • {femaleTeachers} Female
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Classes</CardTitle>
            <GraduationCap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeClasses}</div>
            <div className="text-xs text-muted-foreground mt-1">
              All levels active
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fee Status Overview</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{fullyPaidCount}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Fully Paid • {owingCount} Owing • {noFeeSetCount} No Fee Set
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Fee Status Section with Real Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Eye className="w-5 h-5" />
              <span>Student Fee Status</span>
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
              {totalOwing > 0 && (
                <Badge variant="destructive">
                  Total Owing: GHS {totalOwing.toLocaleString()}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {studentsWithFeeStatus.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No students found in the selected class
              </div>
            ) : (
              <div className="grid gap-4">
                {studentsWithFeeStatus.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div>
                        <div className="font-medium">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {student.classAssigned} • ID: {student.studentId}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {student.feeStatus.status === 'Amount Owing' ? (
                        <div className="text-right">
                          <Badge variant="destructive" className="flex items-center space-x-1 mb-1">
                            <AlertCircle className="w-3 h-3" />
                            <span>Amount Owing</span>
                          </Badge>
                          <div className="text-sm font-mono text-red-600">
                            GHS {student.feeStatus.balance.toLocaleString()}
                          </div>
                        </div>
                      ) : student.feeStatus.status === 'Fully Paid' ? (
                        <Badge variant="default" className="bg-green-500">
                          Fully Paid
                        </Badge>
                      ) : student.feeStatus.status === 'Credit Balance' ? (
                        <div className="text-right">
                          <Badge variant="default" className="bg-blue-500 mb-1">
                            Credit Balance
                          </Badge>
                          <div className="text-sm font-mono text-blue-600">
                            GHS {Math.abs(student.feeStatus.balance).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <Badge variant="outline">
                          No Fee Set
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdministratorDashboard;
