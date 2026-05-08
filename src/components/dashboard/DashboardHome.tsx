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
      arrearsBalances,
      {
        isBeneficiary: !!student.isBeneficiary,
        discountType: student.discountType,
        discountValue: student.discountValue
      }
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
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">School overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3 px-3 py-2 bg-muted rounded-lg w-fit">
          <span className="text-sm text-muted-foreground">Term</span>
          <span className="text-sm font-medium text-foreground">{currentTerm}</span>
        </div>
      </div>

      {/* Financial Summary Dropdown */}
      <FinancialSummary />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">Active enrollments</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">GHS {totalIncome.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Fees + other</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">GHS {expensesThisYear.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">This year</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Balance</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${netBalance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>GHS {netBalance.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Income − Expenses</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">GHS {outstandingBalances.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Pending payments</p>
          </CardContent>
        </Card>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalTeachers}</div>
            <p className="text-xs text-muted-foreground">Active staff</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                <XAxis dataKey="name" stroke="currentColor" className="text-muted-foreground" />
                <YAxis stroke="currentColor" className="text-muted-foreground" />
                <Tooltip 
                  formatter={(value) => [`GHS ${value}`, 'Fees Collected']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="fees" fill="#3B82F6" radius={[4, 4, 0, 0]} />
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
                <Tooltip 
                  formatter={(value) => `GHS ${value}`}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
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
            <Button className="w-full justify-start bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 shadow-none">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
            <Button className="w-full justify-start bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-none">
              <Receipt className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
            <Button className="w-full justify-start bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 shadow-none">
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
                <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'payment' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">{activity.text}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
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
