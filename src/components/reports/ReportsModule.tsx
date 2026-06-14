import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Download, FileText, Calculator, DollarSign, TrendingUp, TrendingDown, Users, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { reportService } from '../../services';
import { getActiveAcademicTerm, getActiveAcademicYear, isActivePayment, paymentAmountValue } from '../../utils/feeCalculations';
import { formatDisplayDate } from '../../utils/dateFormat';

const ReportsModule = () => {
  const { students, payments, income, expenses, feeStructures, classes } = useData();
  const [selectedTerm, setSelectedTerm] = useState('');

  // Get current term from settings - same as Financial Dashboard
  useEffect(() => {
    const currentTerm = getActiveAcademicTerm();
    setSelectedTerm(currentTerm);
  }, []);

  // Generate comprehensive financial summary using the same logic as Financial Dashboard
  const generateFinancialSummary = () => {
    const currentYear = getActiveAcademicYear();
    
    // Fees collected for the selected term (same as Financial Dashboard)
    const feesCollected = payments
      .filter(payment => payment.term === selectedTerm && isActivePayment(payment))
      .reduce((sum, payment) => sum + paymentAmountValue(payment), 0);

    // Other income for the current year (same as Financial Dashboard)
    const otherIncome = income
      .filter(inc => {
        const incomeDate = new Date(inc.date);
        const incomeYear = incomeDate.getFullYear().toString();
        return incomeYear === currentYear;
      })
      .reduce((sum, inc) => sum + inc.amount, 0);

    // Total expenses for the current year (same as Financial Dashboard)
    const totalExpenses = expenses
      .filter(expense => {
        const expenseDate = new Date(expense.paymentDate);
        const expenseYear = expenseDate.getFullYear().toString();
        return expenseYear === currentYear;
      })
      .reduce((sum, expense) => sum + expense.amount, 0);

    const totalIncome = feesCollected + otherIncome;
    const balance = totalIncome - totalExpenses;

    return {
      totalFees: feesCollected,
      totalOtherIncome: otherIncome,
      totalIncome,
      totalExpenses,
      balance,
      feePayments: payments.filter(payment => payment.term === selectedTerm && isActivePayment(payment)),
      currentYearIncome: income.filter(inc => {
        const incomeDate = new Date(inc.date);
        return incomeDate.getFullYear().toString() === currentYear;
      }),
      currentYearExpenses: expenses.filter(expense => {
        const expenseDate = new Date(expense.paymentDate);
        return expenseDate.getFullYear().toString() === currentYear;
      })
    };
  };

  // Generate detailed income breakdown using Financial Dashboard approach
  const generateIncomeBreakdown = () => {
    const financial = generateFinancialSummary();
    
    // Income by source
    const incomeBySource = financial.currentYearIncome.reduce((acc, record) => {
      const source = record.source || 'Other Income';
      acc[source] = (acc[source] || 0) + record.amount;
      return acc;
    }, {} as Record<string, number>);

    // Add school fees as a source
    if (financial.totalFees > 0) {
      incomeBySource['School Fees'] = financial.totalFees;
    }

    // Monthly income trends using Financial Dashboard logic
    const monthlyIncome = [...financial.feePayments, ...financial.currentYearIncome].reduce((acc, record) => {
      const date = new Date(record.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthName, amount: 0, count: 0 };
      }
      acc[monthKey].amount += record.amount;
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
    
    // Expenses by category using Financial Dashboard logic
    const expensesByCategory = financial.currentYearExpenses.reduce((acc, expense) => {
      const category = expense.category || 'Miscellaneous';
      if (!acc[category]) {
        acc[category] = { amount: 0, count: 0, items: [] };
      }
      acc[category].amount += expense.amount;
      acc[category].count += 1;
      acc[category].items.push({
        description: expense.description,
        amount: expense.amount,
        date: expense.paymentDate,
        paymentMethod: expense.paymentMethod
      });
      return acc;
    }, {} as Record<string, any>);

    // Monthly expense trends
    const monthlyExpenses = financial.currentYearExpenses.reduce((acc, expense) => {
      const date = new Date(expense.paymentDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!acc[monthKey]) {
        acc[monthKey] = { month: monthName, amount: 0, count: 0 };
      }
      acc[monthKey].amount += expense.amount;
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
    const expenseMonth = expenseBreakdown.monthly.find((em: any) => em.month === incomeMonth.month);
    return {
      month: incomeMonth.month,
      income: incomeMonth.amount,
      expense: expenseMonth?.amount || 0
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
      
      const filename = `${reportType}-report-${selectedTerm.replace(/\s+/g, '-').toLowerCase()}.json`;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Report Exported Successfully",
        description: `${reportType} report has been exported`,
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
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-foreground">
                Financial Reports & Analytics
              </h1>
              <p className="text-muted-foreground text-lg">Real-time financial insights for {selectedTerm} {getActiveAcademicYear()}</p>
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
          <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <Calendar className="w-6 h-6 text-blue-600" />
                <span>Monthly Income vs Expenses</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={incomeVsExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" />
                  <XAxis dataKey="month" stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                  <YAxis stroke="currentColor" className="text-muted-foreground" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
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
          <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <span>Income Sources</span>
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
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))'
                    }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Breakdown */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Income Details */}
          <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <DollarSign className="w-6 h-6 text-green-600" />
                <span>Income Breakdown</span>
              </CardTitle>
              <Button onClick={() => exportReport('income')} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">Total Income</span>
                    <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">GHS {incomeBreakdown.total.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(incomeBreakdown.bySource)
                    .sort(([,a], [,b]) => (b as number) - (a as number))
                    .map(([source, amount], index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border">
                        <span className="font-medium text-foreground">{source}</span>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600 dark:text-emerald-400">GHS {(amount as number).toLocaleString()}</div>
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
          <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-xl">
                <TrendingDown className="w-6 h-6 text-red-600" />
                <span>Expense Breakdown</span>
              </CardTitle>
              <Button onClick={() => exportReport('expense')} size="sm" variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-red-600 dark:text-red-400">Total Expenses</span>
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">GHS {expenseBreakdown.total.toLocaleString()}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {Object.entries(expenseBreakdown.byCategory)
                    .sort(([,a], [,b]) => (b as any).amount - (a as any).amount)
                    .map(([category, data], index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border">
                        <div>
                          <span className="font-medium text-foreground">{category}</span>
                          <div className="text-sm text-muted-foreground">{(data as any).count} transactions</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-red-600 dark:text-red-400">GHS {((data as any).amount || 0).toLocaleString()}</div>
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
        <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <FileText className="w-6 h-6 text-blue-600" />
              <span>Recent Financial Transactions</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-semibold text-foreground">Date</th>
                    <th className="text-left p-3 font-semibold text-foreground">Type</th>
                    <th className="text-left p-3 font-semibold text-foreground">Description</th>
                    <th className="text-left p-3 font-semibold text-foreground">Category/Source</th>
                    <th className="text-right p-3 font-semibold text-foreground">Amount</th>
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
                      <tr key={index} className="border-b border-border hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground">
                          {formatDisplayDate(transaction.date)}
                        </td>
                        <td className="p-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            transaction.type === 'Income' 
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="p-3 text-foreground">
                          {'description' in transaction ? transaction.description : 
                           'source' in transaction ? `Income from ${transaction.source}` : 
                           'Other transaction'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {'category' in transaction ? transaction.category : 
                           'source' in transaction ? transaction.source : 'N/A'}
                        </td>
                        <td className={`p-3 font-bold text-right ${
                          transaction.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
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
        <Card className="shadow-xl border-border bg-card/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <Download className="w-6 h-6 text-blue-600" />
              <span>Export Financial Reports</span>
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
