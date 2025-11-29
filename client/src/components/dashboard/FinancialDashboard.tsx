
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useExpenses from '@/hooks/useExpenses';
import useFeeStructures from '@/hooks/useFeeStructures';
import useIncome from '@/hooks/useIncome';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import {
  AlertCircle,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users
} from 'lucide-react';
import { useState } from 'react';
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';
import OutstandingFees from '../fees/OutstandingFees';
import FinancialSummary from './FinancialSummary';

const FinancialDashboard = () => {
  const { students } = useStudents();
  const { payments } = usePayments();
  const { income } = useIncome();
  const { expenses } = useExpenses();
  const { feeStructures } = useFeeStructures();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get active academic term and year
  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  // Normalization helpers for API shapes (camelCase / snake_case)
  const getDate = (item: any) => new Date(item?.date ?? item?.paymentDate ?? item?.payment_date ?? Date.now());
  const getAmount = (item: any) => Number(item?.amount ?? item?.value ?? 0) || 0;
  const getTerm = (item: any) => item?.term ?? item?.payment_term ?? '';
  const getExpenseCategory = (e: any) => e?.category ?? e?.title ?? 'Other';
  const getIncomeSource = (i: any) => i?.source ?? i?.description ?? 'Income';
  const getPaymentStudentId = (p: any) => p?.studentId ?? p?.student_id ?? p?.student?.id ?? null;

  // Calculate financial metrics using normalized helpers
  const feesCollected = (payments || [])
    .filter((payment: any) => getTerm(payment) === currentTerm)
    .reduce((sum: number, payment: any) => sum + getAmount(payment), 0);

  const otherIncome = (income || [])
    .filter((inc: any) => getDate(inc).getFullYear().toString() === currentYear)
    .reduce((sum: number, inc: any) => sum + getAmount(inc), 0);

  const totalCombinedIncome = feesCollected + otherIncome;

  const totalExpenses = (expenses || [])
    .filter((expense: any) => getDate(expense).getFullYear().toString() === currentYear)
    .reduce((sum: number, expense: any) => sum + getAmount(expense), 0);

  const balanceLeft = totalCombinedIncome - totalExpenses;

  // Calculate outstanding balances
  const calculateOutstanding = () => {
    let totalOwed = 0;
    students.forEach((student: any) => {
      const studentClassName = student?.classAssigned ?? student?.class_assigned ?? student?.className ?? '';
      const studentFee = (feeStructures || []).find((fee: any) => (fee?.className ?? fee?.class_name) === studentClassName);
      if (studentFee) {
        const studentPayments = (payments || [])
          .filter((payment: any) => getPaymentStudentId(payment) == (student?.id ?? student?.student_id) && getTerm(payment) === currentTerm)
          .reduce((sum: number, payment: any) => sum + getAmount(payment), 0);
        totalOwed += Math.max(0, (Number(studentFee.amount ?? studentFee?.value ?? 0) || 0) - studentPayments);
      }
    });
    return totalOwed;
  };

  const outstandingBalances = calculateOutstanding();

  // Chart data for monthly income trend
  const monthlyIncomeData = Array.from({ length: 12 }, (_, i) => {
    const month = new Date(parseInt(currentYear), i, 1).toLocaleDateString('en-US', { month: 'short' });
    const monthlyFees = (payments || []).filter((payment: any) => {
      const paymentDate = getDate(payment);
      return paymentDate.getMonth() === i && paymentDate.getFullYear().toString() === currentYear;
    }).reduce((sum: number, payment: any) => sum + getAmount(payment), 0);

    const monthlyOtherIncome = (income || []).filter((inc: any) => {
      const incomeDate = getDate(inc);
      return incomeDate.getMonth() === i && incomeDate.getFullYear().toString() === currentYear;
    }).reduce((sum: number, inc: any) => sum + getAmount(inc), 0);

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
    ...(income || []).slice(-3).map((inc: any) => ({
      text: `GHS${getAmount(inc)} other income from ${getIncomeSource(inc)}`,
      time: getDate(inc).toLocaleDateString(),
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
              <h1 className="text-3xl font-bold text-gray-800">Financial Dashboard</h1>
              <p className="text-gray-600">Comprehensive financial overview and management</p>
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
                <p className="text-sm text-gray-500">Current Term</p>
                <p className="text-lg font-semibold text-gray-800">{currentTerm} {currentYear}</p>
              </div>
            </div>
          </div>

          {/* Financial Summary Dropdown */}
          <FinancialSummary />

          {/* Key Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`GHS ${value}`, 'Amount']} />
                    <Line type="monotone" dataKey="fees" stroke="#3B82F6" name="Fees" strokeWidth={2} />
                    <Line type="monotone" dataKey="otherIncome" stroke="#10B981" name="Other Income" strokeWidth={2} />
                    <Line type="monotone" dataKey="total" stroke="#8B5CF6" name="Total" strokeWidth={3} />
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
                    <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'payment' ? 'bg-green-500' :
                        activity.type === 'income' ? 'bg-blue-500' : 'bg-red-500'
                        }`}></div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{activity.text}</p>
                        <p className="text-xs text-gray-500">{activity.time}</p>
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
              <CardContent className="space-y-3">
                <Button className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100 border border-green-200">
                  <Receipt className="w-4 h-4 mr-2" />
                  Record Fee Payment
                </Button>
                <Button className="w-full justify-start bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Other Income
                </Button>
                <Button className="w-full justify-start bg-red-50 text-red-700 hover:bg-red-100 border border-red-200">
                  <FileText className="w-4 h-4 mr-2" />
                  Record Expense
                </Button>
                <Button className="w-full justify-start bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200">
                  <Calculator className="w-4 h-4 mr-2" />
                  Generate Financial Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Outstanding Fees Sidebar */}
      {sidebarOpen && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg border-l border-gray-200 z-50 overflow-y-auto">
          <div className="sticky top-0 z-40 bg-white p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Outstanding Fees by Class</h2>
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
