import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import useExpenses from '@/hooks/useExpenses';
import useFeeStructures from '@/hooks/useFeeStructures';
import useIncome from '@/hooks/useIncome';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import useTeachers from '@/hooks/useTeachers';
import useAcademicTerms from '@/hooks/useAcademicTerms';
import useClasses from '@/hooks/useClasses';
import {
  AlertCircle,
  CreditCard,
  FileText,
  GraduationCap,
  Plus,
  Receipt,
  TrendingDown,
  Users
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { calculateStudentFees, getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';
import FinancialSummary from './FinancialSummary';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { students } = useStudents();
  const { teachers } = useTeachers();
  const { payments } = usePayments();
  const { expenses } = useExpenses();
  const { feeStructures } = useFeeStructures();
  const { income } = useIncome();
  const { terms } = useAcademicTerms();
  const { classes } = useClasses();

  // Get active academic term and year
  const currentTerm = getActiveAcademicTerm(terms);
  const currentYear = getActiveAcademicYear(terms);

  // Normalization helpers (handle camelCase or snake_case API shapes)
  const getDate = (item: any) => new Date(item?.date ?? item?.paymentDate ?? item?.payment_date ?? item?.createdAt ?? item?.created_at ?? Date.now());
  const getAmount = (item: any) => Number(item?.amount ?? item?.value ?? item?.payment_amount ?? 0) || 0;
  const getStudentFirstName = (s: any) => s?.firstName ?? s?.first_name ?? s?.fullName ?? s?.full_name ?? '';
  const getStudentLastName = (s: any) => s?.lastName ?? s?.last_name ?? '';
  const getStudentClass = (s: any) => {
    let className = s?.classAssigned ?? s?.class_assigned ?? s?.className ?? s?.class_name ?? '';
    if (!className && s.class_id && classes && classes.length > 0) {
      const cls = classes.find((c: any) => String(c.id) === String(s.class_id));
      if (cls) {
        className = (cls.level && cls.stream) ? `${cls.level} ${cls.stream}` : (cls.level || cls.class_name || '');
      }
    }
    return className;
  };
  const getFeeClassName = (f: any) => f?.className ?? f?.class_name ?? '';
  const getTerm = (item: any) => {
    let termName = item?.term ?? item?.payment_term ?? item?.term_name ?? '';
    if (!termName && item?.term_id && terms && terms.length > 0) {
      const termObj = terms.find((t: any) => String(t.id) === String(item.term_id));
      if (termObj) termName = termObj.name;
    }
    return termName;
  };

  // Calculate summary statistics
  const totalStudents = students.length;
  const totalTeachers = teachers.length;

  const feesCollectedThisTerm = payments
    .filter(payment => getTerm(payment) === currentTerm)
    .reduce((sum, payment) => sum + getAmount(payment), 0);

  const expensesThisTerm = expenses
    .filter(expense => {
      const expenseDate = getDate(expense);
      const expenseYear = expenseDate.getFullYear().toString();
      return expenseYear === currentYear;
    })
    .reduce((sum, expense) => sum + getAmount(expense), 0);

  // Calculate outstanding balances
  const calculateOutstanding = () => {
    let totalOwed = 0;
    const activeTermObj = terms.find((t: any) => t.isActive || t.is_active) || currentTerm;

    students.forEach(student => {
      const studentClass = getStudentClass(student);
      const calculation = calculateStudentFees(
        student.id,
        activeTermObj,
        studentClass,
        feeStructures,
        payments
      );
      totalOwed += calculation.remainingBalance;
    });
    return totalOwed;
  };

  const outstandingBalances = calculateOutstanding();

  // Prepare chart data
  const classFeesData = feeStructures.map(fee => ({
    name: fee.className,
    fees: payments
      .filter(payment => {
        const student = students.find(s => s.id === payment.studentId);
        return student && student.classAssigned === fee.className && payment.term === currentTerm;
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Rosa Gardens School Management System</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Term</p>
          <p className="text-lg font-semibold text-foreground">{currentTerm}</p>
        </div>
      </div>

      {/* Financial Summary Dropdown */}
      <FinancialSummary />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Students</CardTitle>
            <Users className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalStudents}</div>
            <p className="text-xs text-blue-100">Active enrollments</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fees Collected</CardTitle>
            <CreditCard className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GHS {feesCollectedThisTerm.toLocaleString()}</div>
            <p className="text-xs text-green-100">This term</p>
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

        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expenses</CardTitle>
            <TrendingDown className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">GHS {expensesThisTerm.toLocaleString()}</div>
            <p className="text-xs text-red-100">This term</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teachers</CardTitle>
            <GraduationCap className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTeachers}</div>
            <p className="text-xs text-purple-100">Active staff</p>
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
            <Button
              onClick={() => navigate('/students')}
              className="w-full justify-start bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
            <Button
              onClick={() => navigate('/fees')}
              className="w-full justify-start bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
            >
              <Receipt className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
            <Button
              onClick={() => navigate('/expenses')}
              className="w-full justify-start bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
            >
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
                <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className={`w-2 h-2 rounded-full mt-2 ${activity.type === 'payment' ? 'bg-green-500' : 'bg-red-500'}`}></div>
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
