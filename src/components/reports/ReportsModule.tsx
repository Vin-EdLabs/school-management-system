
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Download, FileText, Calculator, Users, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const ReportsModule = () => {
  const { students, teachers, payments, income, expenses, feeStructures, classes } = useData();
  const [selectedTerm, setSelectedTerm] = useState('Term 1 2024');
  const [selectedClass, setSelectedClass] = useState('All');

  // Calculate financial summary
  const calculateFinancialSummary = () => {
    const totalFees = payments
      .filter(payment => payment.term === selectedTerm)
      .reduce((sum, payment) => sum + payment.amount, 0);
    
    const totalOtherIncome = income
      .filter(inc => {
        const incomeDate = new Date(inc.date);
        return incomeDate.getFullYear() === 2024; // Adjust based on selected term
      })
      .reduce((sum, inc) => sum + inc.amount, 0);

    const totalExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.paymentDate);
        return expenseDate.getFullYear() === 2024; // Adjust based on selected term
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalIncome = totalFees + totalOtherIncome;
    const balance = totalIncome - totalExpenses;

    return { totalFees, totalOtherIncome, totalIncome, totalExpenses, balance };
  };

  // Generate class enrollment report
  const generateClassReport = () => {
    return classes.map(cls => {
      const classStudents = students.filter(student => student.classAssigned === cls.className);
      const classFees = payments.filter(payment => {
        const student = students.find(s => s.id === payment.studentId);
        return student && student.classAssigned === cls.className && payment.term === selectedTerm;
      }).reduce((sum, payment) => sum + payment.amount, 0);

      return {
        className: cls.className,
        enrolled: classStudents.length,
        capacity: cls.maxClassSize,
        utilization: ((classStudents.length / cls.maxClassSize) * 100).toFixed(1),
        feesCollected: classFees
      };
    });
  };

  // Generate outstanding balances report
  const generateOutstandingReport = () => {
    return students.map(student => {
      const studentFee = feeStructures.find(fee => fee.className === student.classAssigned && fee.term === selectedTerm);
      const studentPayments = payments
        .filter(payment => payment.studentId === student.id && payment.term === selectedTerm)
        .reduce((sum, payment) => sum + payment.amount, 0);
      
      const feeAmount = studentFee ? studentFee.amount : 0;
      const outstanding = Math.max(0, feeAmount - studentPayments);

      return {
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.classAssigned,
        totalFee: feeAmount,
        paid: studentPayments,
        outstanding: outstanding
      };
    }).filter(student => student.outstanding > 0);
  };

  const financial = calculateFinancialSummary();
  const classReport = generateClassReport();
  const outstandingReport = generateOutstandingReport();

  // Chart data
  const enrollmentData = classReport.map(cls => ({
    name: cls.className.split(' ').slice(-1)[0], // Get the class level
    enrolled: cls.enrolled,
    capacity: cls.capacity
  }));

  const financialData = [
    { name: 'Fees', amount: financial.totalFees },
    { name: 'Other Income', amount: financial.totalOtherIncome },
    { name: 'Expenses', amount: financial.totalExpenses }
  ];

  const COLORS = ['#3B82F6', '#10B981', '#EF4444'];

  const exportReport = (reportType: string) => {
    let data;
    let filename;

    switch (reportType) {
      case 'financial':
        data = financial;
        filename = `financial-report-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.json`;
        break;
      case 'enrollment':
        data = classReport;
        filename = `enrollment-report-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.json`;
        break;
      case 'outstanding':
        data = outstandingReport;
        filename = `outstanding-balances-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.json`;
        break;
      default:
        data = { financial, enrollment: classReport, outstanding: outstandingReport };
        filename = `complete-report-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.json`;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Report Exported",
      description: `${reportType} report has been exported successfully`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
            <p className="text-gray-600">Generate comprehensive school reports</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <Select value={selectedTerm} onValueChange={setSelectedTerm}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
              <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
              <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Fees</p>
                <p className="text-2xl font-bold">GHS {financial.totalFees.toLocaleString()}</p>
              </div>
              <DollarSign className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Other Income</p>
                <p className="text-2xl font-bold">GHS {financial.totalOtherIncome.toLocaleString()}</p>
              </div>
              <Calculator className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Income</p>
                <p className="text-2xl font-bold">GHS {financial.totalIncome.toLocaleString()}</p>
              </div>
              <BarChart3 className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Expenses</p>
                <p className="text-2xl font-bold">GHS {financial.totalExpenses.toLocaleString()}</p>
              </div>
              <FileText className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${financial.balance >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-orange-500 to-orange-600'} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Balance</p>
                <p className="text-2xl font-bold">GHS {financial.balance.toLocaleString()}</p>
              </div>
              <Calculator className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Enrollment vs Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="enrolled" fill="#3B82F6" name="Enrolled" />
                <Bar dataKey="capacity" fill="#E5E7EB" name="Capacity" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={financialData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {financialData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `GHS ${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Report Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Class Enrollment Report</CardTitle>
            <Button onClick={() => exportReport('enrollment')} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Class</th>
                    <th className="text-left p-2">Enrolled</th>
                    <th className="text-left p-2">Capacity</th>
                    <th className="text-left p-2">Utilization</th>
                    <th className="text-left p-2">Fees Collected</th>
                  </tr>
                </thead>
                <tbody>
                  {classReport.map((cls, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{cls.className}</td>
                      <td className="p-2">{cls.enrolled}</td>
                      <td className="p-2">{cls.capacity}</td>
                      <td className="p-2">{cls.utilization}%</td>
                      <td className="p-2">GHS {cls.feesCollected.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Outstanding Balances</CardTitle>
            <Button onClick={() => exportReport('outstanding')} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Student</th>
                    <th className="text-left p-2">Class</th>
                    <th className="text-left p-2">Total Fee</th>
                    <th className="text-left p-2">Paid</th>
                    <th className="text-left p-2">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingReport.slice(0, 10).map((student, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{student.studentName}</td>
                      <td className="p-2">{student.className}</td>
                      <td className="p-2">GHS {student.totalFee.toLocaleString()}</td>
                      <td className="p-2">GHS {student.paid.toLocaleString()}</td>
                      <td className="p-2 text-red-600">GHS {student.outstanding.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {outstandingReport.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">
                Showing 10 of {outstandingReport.length} students with outstanding balances
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Export Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Export Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Button onClick={() => exportReport('financial')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Financial Report
            </Button>
            <Button onClick={() => exportReport('enrollment')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Enrollment Report
            </Button>
            <Button onClick={() => exportReport('outstanding')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Outstanding Balances
            </Button>
            <Button onClick={() => exportReport('complete')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Complete Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsModule;
