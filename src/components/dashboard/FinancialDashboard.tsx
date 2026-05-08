
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useData } from '../../contexts/DataContext';
import { getActiveAcademicTerm, getActiveAcademicYear, calculateStudentFeesSync } from '../../utils/feeCalculations';
import FinancialSummary from './FinancialSummary';
import OutstandingFees from '../fees/OutstandingFees';
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  Calculator,
  AlertCircle,
  Receipt,
  FileText,
  Plus,
  Users,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const FinancialDashboard = () => {
  const { students, payments, income, expenses, feeStructures, arrearsBalances } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get active academic term and year
  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  // Calculate financial metrics
  const feesCollected = payments
    .filter(payment => payment.term === currentTerm)
    .reduce((sum, payment) => sum + payment.amount, 0);

  const otherIncome = income
    .filter(inc => inc.category !== 'Fee Payment')
    .filter(inc => {
      const incomeDate = new Date(inc.date);
      const incomeYear = incomeDate.getFullYear().toString();
      return incomeYear === currentYear;
    })
    .reduce((sum, inc) => sum + inc.amount, 0);

  const totalCombinedIncome = feesCollected + otherIncome;

  const totalExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.paymentDate);
      const expenseYear = expenseDate.getFullYear().toString();
      return expenseYear === currentYear;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  const balanceLeft = totalCombinedIncome - totalExpenses;

  // Calculate outstanding balances using proper fee structure matching (class_id + term)
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

  // Chart data for monthly income trend
  const monthlyIncomeData = Array.from({length: 12}, (_, i) => {
    const month = new Date(parseInt(currentYear), i, 1).toLocaleDateString('en-US', { month: 'short' });
    const monthlyFees = payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getMonth() === i && paymentDate.getFullYear().toString() === currentYear;
    }).reduce((sum, payment) => sum + payment.amount, 0);
    
    const monthlyOtherIncome = income
      .filter(inc => inc.category !== 'Fee Payment')
      .filter(inc => {
        const incomeDate = new Date(inc.date);
        return incomeDate.getMonth() === i && incomeDate.getFullYear().toString() === currentYear;
      }).reduce((sum, inc) => sum + inc.amount, 0);

    return {
      month,
      fees: monthlyFees,
      otherIncome: monthlyOtherIncome,
      total: monthlyFees + monthlyOtherIncome
    };
  });

  // Expense breakdown for pie chart
  const expenseCategories = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseChartData = Object.entries(expenseCategories).map(([category, amount]) => ({
    name: category,
    value: amount
  }));

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

  // Recent financial activities
  const recentActivities = [
    ...payments.slice(-5).map(payment => {
      const student = students.find(s => s.id === payment.studentId);
      return {
        text: `GHS${payment.amount} fee payment from ${student?.firstName} ${student?.lastName}`,
        time: new Date(payment.date).toLocaleDateString(),
        type: 'payment',
        amount: payment.amount
      };
    }),
    ...income.filter(inc => inc.category !== 'Fee Payment').slice(-3).map(inc => ({
      text: `GHS${inc.amount} other income from ${inc.source}`,
      time: new Date(inc.date).toLocaleDateString(),
      type: 'income',
      amount: inc.amount
    })),
    ...expenses.slice(-3).map(expense => ({
      text: `GHS${expense.amount} expense for ${expense.title}`,
      time: new Date(expense.paymentDate).toLocaleDateString(),
      type: 'expense',
      amount: expense.amount
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'mr-[600px]' : ''}`}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Financial Dashboard</h1>
              <p className="text-muted-foreground">Comprehensive financial overview and management</p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Users className="w-4 h-4" />
                <span>Outstanding Fees</span>
                {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </Button>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Current Term</p>
                <p className="text-lg font-semibold text-foreground">
                  {currentTerm.includes(currentYear) ? currentTerm : `${currentTerm} ${currentYear}`}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Summary Dropdown */}
          <FinancialSummary />

          {/* Key Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-6">
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Fees Collected</CardTitle>
                <CreditCard className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {feesCollected.toLocaleString()}</div>
                <p className="text-xs text-green-100">This term</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Other Income</CardTitle>
                <TrendingUp className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {otherIncome.toLocaleString()}</div>
                <p className="text-xs text-blue-100">This year</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-500 to-teal-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Income</CardTitle>
                <TrendingUp className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {totalCombinedIncome.toLocaleString()}</div>
                <p className="text-xs text-teal-100">Fees + Other Income</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                <TrendingDown className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {totalExpenses.toLocaleString()}</div>
                <p className="text-xs text-red-100">This year</p>
              </CardContent>
            </Card>

            <Card className={`bg-gradient-to-br ${balanceLeft >= 0 ? 'from-indigo-500 to-indigo-600' : 'from-amber-500 to-amber-600'} text-white`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
                <Calculator className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {balanceLeft.toLocaleString()}</div>
                <p className="text-xs opacity-90">Income − Expenses</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
                <AlertCircle className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">GHS {outstandingBalances.toLocaleString()}</div>
                <p className="text-xs text-orange-100">Pending payments</p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Monthly Income Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={monthlyIncomeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                    <XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground" />
                    <YAxis stroke="currentColor" className="text-muted-foreground" />
                    <Tooltip 
                      formatter={(value) => [`GHS ${value}`, 'Amount']}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                      itemStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line type="monotone" dataKey="fees" stroke="#3B82F6" name="Fees" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="otherIncome" stroke="#10B981" name="Other Income" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="total" stroke="#8B5CF6" name="Total" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
                  </LineChart>
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="currentColor" className="text-card" strokeWidth={2} />
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

          {/* Financial Activities and Quick Actions */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Financial Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentActivities.slice(0, 10).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg border border-border">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        activity.type === 'payment' ? 'bg-emerald-500' : 
                        activity.type === 'income' ? 'bg-blue-500' : 'bg-red-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <div className={`text-sm font-medium ${
                        activity.type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {activity.type === 'expense' ? '-' : '+'}GHS{activity.amount.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Financial Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full justify-start bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 shadow-none">
                  <Receipt className="w-4 h-4 mr-2" />
                  Record Fee Payment
                </Button>
                <Button className="w-full justify-start bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 shadow-none">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Other Income
                </Button>
                <Button className="w-full justify-start bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 shadow-none">
                  <FileText className="w-4 h-4 mr-2" />
                  Record Expense
                </Button>
                <Button className="w-full justify-start bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 shadow-none">
                  <Calculator className="w-4 h-4 mr-2" />
                  Generate Financial Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Outstanding Fees Sidebar Drawer */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setSidebarOpen(false)}
          />
          
          <div className="fixed right-0 top-0 h-full w-[600px] bg-card shadow-[-10px_0_30px_rgba(0,0,0,0.5)] border-l border-border z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            <div className="sticky top-0 bg-card/95 backdrop-blur-md p-6 border-b border-border flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-foreground">Outstanding Fees Overview</h2>
                <p className="text-sm text-muted-foreground">Class-wise breakdown and arrears</p>
              </div>
              <Button
                onClick={() => setSidebarOpen(false)}
                variant="ghost"
                size="icon"
                className="hover:bg-muted rounded-full"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-6">
              <OutstandingFees />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FinancialDashboard;
