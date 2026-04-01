import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
import { useData } from '../../contexts/DataContext';
import { getActiveAcademicTerm, getActiveAcademicYear, calculateStudentFeesSync } from '../../utils/feeCalculations';
import FinancialSummary from './FinancialSummary';
import OutstandingFees from '../fees/OutstandingFees';
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useExpenses from '@/hooks/useExpenses';
import useFeeStructures from '@/hooks/useFeeStructures';
import useIncome from '@/hooks/useIncome';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import useAcademicTerms from '@/hooks/useAcademicTerms';
import useClasses from '@/hooks/useClasses';
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx
import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DollarSign,
  FileText,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet
} from 'lucide-react';
import React, { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateStudentFees, getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';
import OutstandingFees from '../fees/OutstandingFees';
import FinancialSummary from './FinancialSummary';

const FinancialDashboard = () => {
<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
  const { students, payments, income, expenses, feeStructures, arrearsBalances } = useData();
=======
  const navigate = useNavigate();
  const { students } = useStudents();
  const { payments } = usePayments();
  const { income } = useIncome();
  const { expenses } = useExpenses();
  const { feeStructures } = useFeeStructures();
  const { terms } = useAcademicTerms();
  const { classes } = useClasses();
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get active academic term and year
  const currentTerm = getActiveAcademicTerm(terms);
  const currentYear = getActiveAcademicYear(terms);

  // Normalization helpers for API shapes (camelCase / snake_case)
  const getDate = (item: any) => new Date(item?.date ?? item?.paymentDate ?? item?.payment_date ?? Date.now());
  const getAmount = (item: any) => Number(item?.amount ?? item?.value ?? 0) || 0;
  const getTerm = (item: any) => {
    let termName = item?.term ?? item?.payment_term ?? item?.term_name ?? '';
    if (!termName && item?.term_id && terms && terms.length > 0) {
      const termObj = terms.find((t: any) => String(t.id) === String(item.term_id));
      if (termObj) termName = termObj.name;
    }
    return termName;
  };
  const getExpenseCategory = (e: any) => e?.category ?? e?.title ?? 'Other';
  const getIncomeSource = (i: any) => i?.source ?? i?.description ?? 'Income';
  const getPaymentStudentId = (p: any) => p?.studentId ?? p?.student_id ?? p?.student?.id ?? null;

<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
  const otherIncome = income
    .filter(inc => inc.category !== 'Fee Payment')
    .filter(inc => {
      const incomeDate = new Date(inc.date);
      const incomeYear = incomeDate.getFullYear().toString();
      return incomeYear === currentYear;
    })
    .reduce((sum, inc) => sum + inc.amount, 0);
=======
  // Calculate financial metrics using normalized helpers
  const feesCollected = (payments || [])
    .filter((payment: any) => getTerm(payment) === currentTerm)
    .reduce((sum: number, payment: any) => sum + getAmount(payment), 0);

  const otherIncome = (income || [])
    .filter((inc: any) => getDate(inc).getFullYear().toString() === currentYear)
    .reduce((sum: number, inc: any) => sum + getAmount(inc), 0);
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx

  const totalCombinedIncome = feesCollected + otherIncome;

  const totalExpenses = (expenses || [])
    .filter((expense: any) => getDate(expense).getFullYear().toString() === currentYear)
    .reduce((sum: number, expense: any) => sum + getAmount(expense), 0);

  const balanceLeft = totalCombinedIncome - totalExpenses;

<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
  // Calculate outstanding balances using proper fee structure matching (class_id + term)
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
=======
  // Calculate outstanding balances
  const calculateOutstanding = () => {
    let totalOwed = 0;
    const activeTermObj = terms.find((t: any) => t.isActive || t.is_active) || currentTerm;

    students.forEach((student: any) => {
      let studentClassName = student?.classAssigned ?? student?.class_assigned ?? student?.className ?? '';
      if (!studentClassName && student.class_id && classes && classes.length > 0) {
        const cls = classes.find((c: any) => String(c.id) === String(student.class_id));
        if (cls) {
          studentClassName = (cls.level && cls.stream) ? `${cls.level} ${cls.stream}` : (cls.level || cls.class_name || '');
        }
      }

      const calculation = calculateStudentFees(
        student.id,
        activeTermObj,
        studentClassName,
        feeStructures,
        payments
      );

      totalOwed += calculation.remainingBalance;
    });
    return totalOwed;
  };

  const outstandingBalances = calculateOutstanding();
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx

  // Chart data for monthly income trend
  const monthlyIncomeData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(parseInt(currentYear), i, 1).toLocaleDateString('en-US', { month: 'short' });
    const monthlyFees = (payments || []).filter((payment: any) => {
      const paymentDate = getDate(payment);
      return paymentDate.getMonth() === i && paymentDate.getFullYear().toString() === currentYear;
<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
    }).reduce((sum, payment) => sum + payment.amount, 0);
    
    const monthlyOtherIncome = income
      .filter(inc => inc.category !== 'Fee Payment')
      .filter(inc => {
        const incomeDate = new Date(inc.date);
        return incomeDate.getMonth() === i && incomeDate.getFullYear().toString() === currentYear;
      }).reduce((sum, inc) => sum + inc.amount, 0);
=======
    }).reduce((sum: number, payment: any) => sum + getAmount(payment), 0);

    const monthlyOtherIncome = (income || []).filter((inc: any) => {
      const incomeDate = getDate(inc);
      return incomeDate.getMonth() === i && incomeDate.getFullYear().toString() === currentYear;
    }).reduce((sum: number, inc: any) => sum + getAmount(inc), 0);
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx

    return {
      month,
      fees: monthlyFees,
      otherIncome: monthlyOtherIncome,
      total: monthlyFees + monthlyOtherIncome
    };
  });

  // Expense breakdown for pie chart
  const expenseCategories = (expenses || []).reduce((acc: Record<string, number>, expense: any) => {
    const key = getExpenseCategory(expense);
    acc[key] = (acc[key] || 0) + getAmount(expense);
    return acc;
  }, {} as Record<string, number>);

  const expenseChartData = Object.entries(expenseCategories).map(([category, amount]) => ({
    name: category,
    value: amount
  }));

  const COLORS = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444'];

  // Recent financial activities
  const recentActivities = [
    ...(payments || []).slice(-5).map((payment: any) => {
      const studentId = getPaymentStudentId(payment);
      const student = (students || []).find((s: any) => (s?.id ?? s?.student_id) == studentId);
      return {
        text: `GHS${getAmount(payment)} fee payment from ${(student ? ((student?.firstName ?? student?.first_name ?? student?.fullName ?? student?.full_name) + ' ' + (student?.lastName ?? student?.last_name ?? '')) : 'Unknown Student')}`,
        time: getDate(payment).toLocaleDateString(),
        type: 'payment',
        amount: getAmount(payment)
      };
    }),
<<<<<<< HEAD:src/components/dashboard/FinancialDashboard.tsx
    ...income.filter(inc => inc.category !== 'Fee Payment').slice(-3).map(inc => ({
      text: `GHS${inc.amount} other income from ${inc.source}`,
      time: new Date(inc.date).toLocaleDateString(),
=======
    ...(income || []).slice(-3).map((inc: any) => ({
      text: `GHS${getAmount(inc)} other income from ${getIncomeSource(inc)}`,
      time: getDate(inc).toLocaleDateString(),
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/dashboard/FinancialDashboard.tsx
      type: 'income',
      amount: getAmount(inc)
    })),
    ...(expenses || []).slice(-3).map((expense: any) => ({
      text: `GHS${getAmount(expense)} expense for ${expense?.title ?? expense?.name ?? 'Expense'}`,
      time: getDate(expense).toLocaleDateString(),
      type: 'expense',
      amount: getAmount(expense)
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 transition-all duration-300">
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
                <p className="text-lg font-semibold text-foreground">{currentTerm} {currentYear}</p>
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
                  <BarChart data={monthlyIncomeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`GHS ${value}`, 'Amount']} />
                    <Legend />
                    <Bar dataKey="fees" fill="#3B82F6" name="Fees" />
                    <Bar dataKey="otherIncome" fill="#10B981" name="Other Income" />
                    <Bar dataKey="total" fill="#8B5CF6" name="Total" />
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

          {/* Financial Activities and Quick Actions */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Financial Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {recentActivities.slice(0, 10).map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'payment' ? 'bg-green-500' :
                        activity.type === 'income' ? 'bg-blue-500' : 'bg-red-500'
                        }`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-foreground">{activity.text}</p>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                      <div className={`text-sm font-medium ${activity.type === 'expense' ? 'text-red-600' : 'text-green-600'
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={() => navigate('/fees')}
                  variant="outline"
                  className="w-full justify-start h-12 bg-green-50/50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300 transition-all font-medium"
                >
                  <Receipt className="w-5 h-5 mr-3" />
                  Record Fees
                </Button>
                <Button
                  onClick={() => navigate('/income')}
                  variant="outline"
                  className="w-full justify-start h-12 bg-blue-50/50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-all font-medium"
                >
                  <TrendingUp className="w-5 h-5 mr-3" />
                  Other Income
                </Button>
                <Button
                  onClick={() => navigate('/expenses')}
                  variant="outline"
                  className="w-full justify-start h-12 bg-red-50/50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300 transition-all font-medium"
                >
                  <TrendingDown className="w-5 h-5 mr-3" />
                  Add Expense
                </Button>
                <Button
                  onClick={() => navigate('/staff-payroll')}
                  variant="outline"
                  className="w-full justify-start h-12 bg-purple-50/50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300 transition-all font-medium"
                >
                  <Wallet className="w-5 h-5 mr-3" />
                  Process Payroll
                </Button>
                <Button
                  onClick={() => navigate('/reports')}
                  variant="outline"
                  className="w-full justify-start h-12 col-span-1 sm:col-span-2 bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all font-medium"
                >
                  <BarChart3 className="w-5 h-5 mr-3" />
                  Financial Reports
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Outstanding Fees Sidebar */}
      {sidebarOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-card shadow-lg border-l border-border z-50 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-card p-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Outstanding Fees by Class</h2>
            <Button
              onClick={() => setSidebarOpen(false)}
              variant="ghost"
              size="sm"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="p-4">
            <OutstandingFees compact />
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;
