import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useData } from '../../contexts/DataContext';
import { getActiveAcademicTerm, getActiveAcademicYear, calculateStudentFeesSync } from '../../utils/feeCalculations';
import FinancialSummary from './FinancialSummary';
import {
  Users,
  CreditCard,
  AlertCircle,
  TrendingDown,
  GraduationCap,
  Plus,
  Receipt,
  FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DashboardHome = () => {
  const { students, teachers, classes = [], payments, expenses, feeStructures, income, arrearsBalances } = useData();

  // Get active academic term and year
  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  // Calculate summary statistics
  const totalStudents = students.length;
  const totalTeachers = teachers.length;
  
  const feesCollectedThisTerm = payments
    .filter(payment => {
      const pt = payment.term || '';
      return pt === currentTerm || pt.includes(currentTerm) || currentTerm.includes(pt);
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  const otherIncomeThisYear = income
    .filter(inc => inc.category !== 'Fee Payment')
    .filter(inc => {
      const d = new Date(inc.date);
      return d.getFullYear().toString() === currentYear;
    })
    .reduce((sum, inc) => sum + inc.amount, 0);

  const totalIncome = feesCollectedThisTerm + otherIncomeThisYear;
  
  const expensesThisYear = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.paymentDate);
      const expenseYear = expenseDate.getFullYear().toString();
      return expenseYear === currentYear;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const netBalance = totalIncome - expensesThisYear;

  // Calculate outstanding balances using proper fee structure matching (class + term)
  const outstandingBalances = students.reduce((totalOwed, student) => {
    const feeCalc = calculateStudentFeesSync(
      student.id,
      currentTerm,
      student.classAssigned,
      feeStructures || [],
      payments || [],
      student.classAssignedId,
      arrearsBalances
    );
    const outstanding = Math.max(0, (feeCalc.totalAmountDue ?? feeCalc.currentTermFee) - feeCalc.totalPaid);
    return totalOwed + outstanding;
  }, 0);

  // Prepare chart data - fees collected per class (one bar per class)
  const uniqueClassNames = [...new Set(classes.map(c => c.className).filter(Boolean))];
  const classFeesData = uniqueClassNames.map(className => ({
    name: className,
    fees: payments
      .filter(payment => {
        const student = students.find(s => s.id === payment.studentId);
        const termMatch = (payment.term || '') === currentTerm || (payment.term || '').includes(currentTerm) || currentTerm.includes(payment.term || '');
        return student && student.classAssigned === className && termMatch;
      })
      .reduce((sum, payment) => sum + payment.amount, 0)
  }));

  const expenseCategories = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseChartData = Object.entries(expenseCategories).map(([category, amount]) => ({
    name: category,
    value: amount
  }));

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

  // Recent activities
  const recentActivities = [
    ...payments.slice(-3).map(payment => {
      const student = students.find(s => s.id === payment.studentId);
      return {
        text: `GHS${payment.amount} payment recorded for ${student?.firstName} ${student?.lastName}, ${student?.classAssigned}`,
        time: new Date(payment.date).toLocaleDateString(),
        type: 'payment'
      };
    }),
    ...expenses.slice(-2).map(expense => ({
      text: `GHS${expense.amount} expense recorded for ${expense.title}`,
      time: new Date(expense.paymentDate).toLocaleDateString(),
      type: 'expense'
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">School overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 bg-slate-100 rounded-lg w-fit">
          <span className="text-sm text-slate-500">Term</span>
          <span className="text-sm font-medium text-slate-800">{currentTerm}</span>
        </div>
      </div>

      {/* Financial Summary Dropdown */}
      <FinancialSummary />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Students</CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalStudents}</div>
            <p className="text-xs text-slate-500">Active enrollments</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Income</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">GHS {totalIncome.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Fees + other</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">GHS {expensesThisYear.toLocaleString()}</div>
            <p className="text-xs text-slate-500">This year</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Net Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-amber-600'}`}>GHS {netBalance.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Income − Expenses</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">GHS {outstandingBalances.toLocaleString()}</div>
            <p className="text-xs text-slate-500">Pending payments</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{totalTeachers}</div>
            <p className="text-xs text-slate-500">Active staff</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Fees Collection by Class</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={classFeesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => [`GHS ${value}`, 'Fees Collected']} />
                <Bar dataKey="fees" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `GHS ${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
            <Button className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
              <Receipt className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
            <Button className="w-full justify-start bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200">
              <FileText className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivities.slice(0, 5).map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'payment' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{activity.text}</p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardHome;
