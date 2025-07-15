
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useData } from '../../contexts/DataContext';
import { Users, GraduationCap, School, User, DollarSign } from 'lucide-react';

const AdministratorDashboard = () => {
  const { students, teachers, classes, payments } = useData();

  // Calculate statistics
  const maleStudents = students.filter(s => s.gender === 'male').length;
  const femaleStudents = students.filter(s => s.gender === 'female').length;
  const maleTeachers = teachers.filter(t => t.gender === 'male').length;
  const femaleTeachers = teachers.filter(t => t.gender === 'female').length;

  // Calculate student payment status
  const getStudentPaymentStatus = (studentId: string) => {
    const studentPayments = payments.filter(p => p.studentId === studentId);
    const totalPaid = studentPayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    // Get student's fee structure (assuming a standard fee for now)
    const standardFee = 1000; // This should come from fee structures
    const amountOwing = standardFee - totalPaid;
    
    return {
      totalPaid,
      amountOwing: amountOwing > 0 ? amountOwing : 0,
      isFullyPaid: amountOwing <= 0
    };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Administrator Dashboard</h1>
            <p className="text-gray-600">Manage students, teachers, and classes</p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{students.length}</div>
            <p className="text-xs text-muted-foreground">
              {maleStudents} Male, {femaleStudents} Female
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teachers.length}</div>
            <p className="text-xs text-muted-foreground">
              {maleTeachers} Male, {femaleTeachers} Female
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Classes</CardTitle>
            <School className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{classes.length}</div>
            <p className="text-xs text-muted-foreground">Active classes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fully Paid Students</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students.filter(s => getStudentPaymentStatus(s.id).isFullyPaid).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Out of {students.length} students
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Student Payment Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Student Fee Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {students.map((student) => {
              const paymentStatus = getStudentPaymentStatus(student.id);
              return (
                <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <User className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-800">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-sm text-gray-500">{student.class}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {paymentStatus.isFullyPaid ? (
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        Fully Paid
                      </span>
                    ) : (
                      <div className="text-right">
                        <span className="px-3 py-1 bg-red-100 text-red-800 text-sm font-medium rounded-full">
                          Amount Owing: ₵{paymentStatus.amountOwing}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdministratorDashboard;
