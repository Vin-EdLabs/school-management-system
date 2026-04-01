import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useExpenses from '@/hooks/useExpenses';
import useFeeStructures from '@/hooks/useFeeStructures';
import useIncome from '@/hooks/useIncome';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { BarChart3, Calculator, Calendar, DollarSign, Download, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import useAcademicTerms from '@/hooks/useAcademicTerms';
import { reportService } from '../../services';
import { getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

const ReportsModule = () => {
  const { feeStructures } = useFeeStructures();
  const { classes } = useClasses();
  const { terms } = useAcademicTerms();
  const { payments } = usePayments();
  const { income } = useIncome();
  const { expenses } = useExpenses();

  // Normalizers - produce arrays with consistent fields used by reports
  const normalizePayment = (p: any) => {
    let termName = p?.term ?? p?.payment_term ?? p?.term_name ?? '';

    // If we have a term_id but no term name, find it from our terms hook data
    if (!termName && p?.term_id && terms && terms.length > 0) {
      const termObj = terms.find((t: any) => String(t.id) === String(p.term_id));
      if (termObj) termName = termObj.name;
    }

    return {
      ...p,
      term: termName,
      amount: Number(p?.amount ?? p?.value ?? 0) || 0,
      date: p?.date ?? p?.paymentDate ?? p?.payment_date ?? new Date().toISOString(),
    };
  };

  const normalizeIncome = (i: any) => ({
    ...i,
    source: i?.source ?? i?.description ?? 'Other Income',
    amount: Number(i?.amount ?? i?.value ?? 0) || 0,
    date: i?.date ?? i?.paymentDate ?? i?.payment_date ?? new Date().toISOString(),
  });

  const normalizeExpense = (e: any) => ({
    ...e,
    category: e?.category ?? e?.type ?? 'Miscellaneous',
    amount: Number(e?.amount ?? e?.value ?? 0) || 0,
    date: e?.paymentDate ?? e?.payment_date ?? e?.date ?? new Date().toISOString(),
    description: e?.description ?? e?.title ?? ''
  });

  const normalizedPayments = (payments || []).map(normalizePayment);
  const normalizedIncome = (income || []).map(normalizeIncome);
  const normalizedExpenses = (expenses || []).map(normalizeExpense);
  const [selectedTerm, setSelectedTerm] = useState('');

  // Get current term from settings
  useEffect(() => {
    if (terms && terms.length > 0) {
      const currentTerm = getActiveAcademicTerm(terms);
      setSelectedTerm(currentTerm);
    }
  }, [terms]);

  // Generate comprehensive financial summary using the same logic as Financial Dashboard
  const generateFinancialSummary = () => {
    const currentYear = getActiveAcademicYear(terms);

    // Fees collected for the selected term
    const feesCollected = normalizedPayments
      .filter(p => p.term === selectedTerm)
      .reduce((sum, p) => sum + p.amount, 0);

    // Other income for the current year
    const otherIncome = normalizedIncome
      .filter(inc => new Date(inc.date).getFullYear().toString() === currentYear)
      .reduce((sum, inc) => sum + inc.amount, 0);

    // Total expenses for the current year
    const totalExpenses = normalizedExpenses
      .filter(exp => new Date(exp.date).getFullYear().toString() === currentYear)
      .reduce((sum, exp) => sum + exp.amount, 0);

    const totalIncome = feesCollected + otherIncome;
    const balance = totalIncome - totalExpenses;

    return {
      totalFees: feesCollected,
      totalOtherIncome: otherIncome,
      totalIncome,
      totalExpenses,
      balance,
      feePayments: normalizedPayments.filter(p => p.term === selectedTerm),
      currentYearIncome: normalizedIncome.filter(inc => new Date(inc.date).getFullYear().toString() === currentYear),
      currentYearExpenses: normalizedExpenses.filter(exp => new Date(exp.date).getFullYear().toString() === currentYear)
    };
  };

  // Generate detailed income breakdown using Financial Dashboard approach
  const generateIncomeBreakdown = () => {
    const financial = generateFinancialSummary();

    // Income by source
    const incomeBySource = financial.currentYearIncome.reduce((acc: Record<string, number>, record: any) => {
      const source = record.source || record.description || 'Other Income';
      acc[source] = (acc[source] || 0) + (Number(record.amount) || 0);
      return acc;
    }, {} as Record<string, number>);

    // Add school fees as a source
    if (financial.totalFees > 0) {
      incomeBySource['School Fees'] = financial.totalFees;
    }

    // Monthly income trends using Financial Dashboard logic
    const monthlyIncome = [...financial.feePayments, ...financial.currentYearIncome].reduce((acc: Record<string, any>, record: any) => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthName, amount: 0, count: 0 };
      }
      acc[monthKey].amount += Number(record.amount) || 0;
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return {
      bySource: incomeBySource,
      monthly: Object.values(monthlyIncome).sort((a: any, b: any) => a.month.localeCompare(b.month)),
      total: financial.totalIncome
    };
  };

  // Generate detailed expense breakdown using Financial Dashboard approach
  const generateExpenseBreakdown = () => {
    const financial = generateFinancialSummary();

    // Expenses by category
    const expensesByCategory = financial.currentYearExpenses.reduce((acc: Record<string, any>, expense: any) => {
      const category = expense.category || 'Miscellaneous';
      if (!acc[category]) {
        acc[category] = { amount: 0, count: 0, items: [] };
      }
      acc[category].amount += Number(expense.amount) || 0;
      acc[category].count += 1;
      acc[category].items.push({
        description: expense.description || expense.title,
        amount: Number(expense.amount) || 0,
        date: expense.date,
        paymentMethod: expense.paymentMethod || expense.method
      });
      return acc;
    }, {} as Record<string, any>);

    // Monthly expense trends
    const monthlyExpenses = financial.currentYearExpenses.reduce((acc: Record<string, any>, expense: any) => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthName, amount: 0, count: 0 };
      }
      acc[monthKey].amount += Number(expense.amount) || 0;
      acc[monthKey].count += 1;
      return acc;
    }, {} as Record<string, any>);

    return {
      byCategory: expensesByCategory,
      monthly: Object.values(monthlyExpenses).sort((a: any, b: any) => a.month.localeCompare(b.month)),
      total: financial.totalExpenses
    };
  };

  const financial = generateFinancialSummary();
  const incomeBreakdown = generateIncomeBreakdown();
  const expenseBreakdown = generateExpenseBreakdown();

  // Prepare chart data using Financial Dashboard approach
  const incomeVsExpenseData = incomeBreakdown.monthly.map((incomeMonth: any) => {
    const expenseMonth = expenseBreakdown.monthly.find((em: any) => em.month === incomeMonth.month) as any;
    return {
      month: incomeMonth.month,
      income: incomeMonth.amount,
      expense: (expenseMonth?.amount as number) || 0
    };
  });

  // Income source pie chart data
  const incomeSourceData = Object.entries(incomeBreakdown.bySource).map(([source, amount]) => ({
    name: source,
    value: amount as number
  }));

  // Expense category pie chart data
  const expenseCategoryData = Object.entries(expenseBreakdown.byCategory).map(([category, data]) => ({
    name: category,
    value: (data as any).amount
  }));

  const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

  const exportReport = async (reportType: string) => {
    try {
      const data = reportService.generateReport(reportType, {
        financial,
        incomeBreakdown,
        expenseBreakdown,
        selectedTerm
      });

      await reportService.exportReportToExcel(data, reportType);

      toast({
        title: "Report Exported Successfully",
        description: `${reportType} report has been exported as XLSX`,
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the report",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 transition-colors duration-500">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Financial Reports & Analytics
              </h1>
              <p className="text-muted-foreground text-lg">Real-time financial insights for {selectedTerm} {getActiveAcademicYear(terms)}</p>
            </div>
          </div>
        </div>

        {/* Financial Summary Cards using Financial Dashboard data */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-medium">School Fees</p>
                  <p className="text-3xl font-bold">GHS {financial.totalFees.toLocaleString()}</p>
                  <p className="text-xs opacity-75 mt-1">{financial.feePayments.length} payments</p>
                </div>
                <DollarSign className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-medium">Other Income</p>
                  <p className="text-3xl font-bold">GHS {financial.totalOtherIncome.toLocaleString()}</p>
                  <p className="text-xs opacity-75 mt-1">{financial.currentYearIncome.length} sources</p>
                </div>
                <TrendingUp className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-medium">Total Income</p>
                  <p className="text-3xl font-bold">GHS {financial.totalIncome.toLocaleString()}</p>
                  <p className="text-xs opacity-75 mt-1">All sources combined</p>
                </div>
                <BarChart3 className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-medium">Total Expenses</p>
                  <p className="text-3xl font-bold">GHS {financial.totalExpenses.toLocaleString()}</p>
                  <p className="text-xs opacity-75 mt-1">{financial.currentYearExpenses.length} transactions</p>
                </div>
                <TrendingDown className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${financial.balance >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-orange-500 to-orange-600'} text-white shadow-xl border-0`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-90 font-medium">Net Balance</p>
                  <p className="text-3xl font-bold">GHS {financial.balance.toLocaleString()}</p>
                  <p className="text-xs opacity-75 mt-1">{financial.balance >= 0 ? 'Profit' : 'Loss'}</p>
                </div>
                <Calculator className="w-10 h-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Income vs Expenses Trend */}
          <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <span className="text-foreground">Monthly Income vs Expenses</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={incomeVsExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="income"
                    stroke="#10B981"
                    strokeWidth={3}
                    name="Income"
                    dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="expense"
                    stroke="#EF4444"
                    strokeWidth={3}
                    name="Expense"
                    dot={{ fill: '#EF4444', strokeWidth: 2, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Income Sources */}
          <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-foreground">Income Sources</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={incomeSourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {incomeSourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`GHS ${value.toLocaleString()}`, 'Amount']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Income Details */}
          <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                <span className="text-foreground">Income Breakdown</span>
              </CardTitle>
              <Button onClick={() => exportReport('income')} size="sm" variant="outline" className="dark:border-slate-800">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-green-800 dark:text-green-300">Total Income</span>
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">GHS {incomeBreakdown.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(incomeBreakdown.bySource)
                    .sort(([, a], [, b]) => (b as number) - (a as number))
                    .map(([source, amount], index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                        <span className="font-medium text-muted-foreground">{source}</span>
                        <div className="text-right">
                          <div className="font-bold text-green-600">GHS {(amount as number).toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {((amount as number / incomeBreakdown.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Expense Details */}
          <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                <span className="text-foreground">Expense Breakdown</span>
              </CardTitle>
              <Button onClick={() => exportReport('expense')} size="sm" variant="outline" className="dark:border-slate-800">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-800 dark:text-red-300">Total Expenses</span>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">GHS {expenseBreakdown.total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {Object.entries(expenseBreakdown.byCategory)
                    .sort(([, a], [, b]) => (b as any).amount - (a as any).amount)
                    .map(([category, data], index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 dark:bg-slate-950 rounded-lg border border-transparent dark:border-slate-800">
                        <div>
                          <span className="font-medium text-muted-foreground">{category}</span>
                          <div className="text-sm text-muted-foreground">{(data as any).count} transactions</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600">GHS {((data as any).amount || 0).toLocaleString()}</div>
                          <div className="text-sm text-muted-foreground">
                            {(((data as any).amount / expenseBreakdown.total) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Transactions */}
        <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-foreground">Recent Financial Transactions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-muted-foreground">Date</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground">Type</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground">Description</th>
                    <th className="text-left p-3 font-semibold text-muted-foreground">Category/Source</th>
                    <th className="text-right p-3 font-semibold text-muted-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ...financial.currentYearIncome.map(item => ({ ...item, type: 'Income' as const })),
                    ...financial.currentYearExpenses.map(item => ({ ...item, type: 'Expense' as const, date: item.paymentDate }))
                  ]
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
                    .map((transaction, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-muted/50">
                        <td className="p-3 text-muted-foreground">
                          {new Date(transaction.date).toLocaleDateString()}
                        </td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${transaction.type === 'Income'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {'description' in transaction ? transaction.description :
                            'source' in transaction ? `Income from ${transaction.source}` :
                              'Other transaction'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {'category' in transaction ? transaction.category :
                            'source' in transaction ? transaction.source : 'N/A'}
                        </td>
                        <td className={`p-3 font-bold text-right ${transaction.type === 'Income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                          {transaction.type === 'Income' ? '+' : '-'}GHS {transaction.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Export Actions */}
        <Card className="shadow-xl border-0 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <Download className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <span className="text-foreground">Export Financial Reports</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button onClick={() => exportReport('financial')} variant="outline" className="h-12">
                <Download className="w-4 h-4 mr-2" />
                Complete Financial Report
              </Button>
              <Button onClick={() => exportReport('income')} variant="outline" className="h-12">
                <TrendingUp className="w-4 h-4 mr-2" />
                Income Analysis
              </Button>
              <Button onClick={() => exportReport('expense')} variant="outline" className="h-12">
                <TrendingDown className="w-4 h-4 mr-2" />
                Expense Analysis
              </Button>
              <Button onClick={() => exportReport('summary')} variant="outline" className="h-12">
                <BarChart3 className="w-4 h-4 mr-2" />
                Executive Summary
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsModule;
