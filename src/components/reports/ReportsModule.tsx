
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Download, FileText, Calculator, DollarSign } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { getActiveAcademicTerm, calculateStudentFees } from '../../utils/feeCalculations';
import { reportService } from '../../services';

const ReportsModule = () => {
  const { students, payments, income, expenses, feeStructures, classes } = useData();
  const [selectedTerm, setSelectedTerm] = useState(getActiveAcademicTerm());

  // Generate financial summary from real data
  const generateFinancialSummary = () => {
    const currentYear = selectedTerm.split(' ').pop() || new Date().getFullYear().toString();
    
    const feePayments = payments.filter(payment => payment.term === selectedTerm);
    const totalFees = feePayments.reduce((sum, payment) => sum + payment.amount, 0);
    
    const currentYearIncome = income.filter(inc => {
      const incomeDate = new Date(inc.date);
      return incomeDate.getFullYear().toString() === currentYear;
    });
    const totalOtherIncome = currentYearIncome.reduce((sum, inc) => sum + inc.amount, 0);
    
    const currentYearExpenses = expenses.filter(expense => {
      const expenseDate = new Date(expense.paymentDate);
      return expenseDate.getFullYear().toString() === currentYear;
    });
    const totalExpenses = currentYearExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    
    const totalIncome = totalFees + totalOtherIncome;
    const balance = totalIncome - totalExpenses;

    return {
      totalFees,
      totalOtherIncome,
      totalIncome,
      totalExpenses,
      balance,
      feePayments,
      currentYearIncome,
      currentYearExpenses
    };
  };

  // Generate class financial report
  const generateClassReport = () => {
    return classes.map(cls => {
      const classStudents = students.filter(student => student.classAssigned === cls.className);
      
      let totalFeesExpected = 0;
      let totalFeesCollected = 0;
      let totalArrears = 0;
      
      classStudents.forEach(student => {
        const feeCalculation = calculateStudentFees(
          student.id,
          selectedTerm,
          student.classAssigned,
          feeStructures,
          payments
        );
        
        totalFeesExpected += feeCalculation.currentTermFee;
        totalFeesCollected += feeCalculation.totalPaid;
        totalArrears += feeCalculation.arrears;
      });

      return {
        className: cls.className,
        enrolled: classStudents.length,
        capacity: cls.maxClassSize,
        utilization: cls.maxClassSize > 0 ? ((classStudents.length / cls.maxClassSize) * 100).toFixed(1) : '0',
        totalFeesExpected,
        totalFeesCollected,
        totalArrears,
        outstandingBalance: totalFeesExpected - totalFeesCollected + totalArrears
      };
    });
  };

  // Generate outstanding balances report
  const generateOutstandingReport = () => {
    return students.map(student => {
      const feeCalculation = calculateStudentFees(
        student.id,
        selectedTerm,
        student.classAssigned,
        feeStructures,
        payments
      );

      const outstanding = Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid);

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        className: student.classAssigned,
        currentTermFee: feeCalculation.currentTermFee,
        arrears: feeCalculation.arrears,
        totalAmountDue: feeCalculation.totalAmountDue,
        totalPaid: feeCalculation.totalPaid,
        outstanding
      };
    }).filter(student => student.outstanding > 0);
  };

  const financial = generateFinancialSummary();
  const classReport = generateClassReport();
  const outstandingReport = generateOutstandingReport();

  // Chart data for categories
  const incomeByCategory = financial.currentYearIncome.reduce((acc, record) => {
    const category = record.category || record.source || 'Other';
    acc[category] = (acc[category] || 0) + record.amount;
    return acc;
  }, {} as Record<string, number>);

  const expenseByCategory = financial.currentYearExpenses.reduce((acc, record) => {
    const category = record.category || 'Other';
    acc[category] = (acc[category] || 0) + record.amount;
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = [
    ...Object.entries(incomeByCategory).map(([category, amount]) => ({
      name: category,
      income: amount,
      expense: 0
    })),
    ...Object.entries(expenseByCategory).map(([category, amount]) => ({
      name: category,
      income: 0,
      expense: amount
    }))
  ];

  // Monthly trends
  const allTransactions = [
    ...financial.feePayments.map(p => ({ ...p, type: 'Income' as const })),
    ...financial.currentYearIncome.map(i => ({ ...i, type: 'Income' as const })),
    ...financial.currentYearExpenses.map(e => ({ ...e, type: 'Expense' as const, date: e.paymentDate }))
  ];

  const monthlyTrends = allTransactions.reduce((acc, transaction) => {
    const month = new Date(transaction.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    if (!acc[month]) {
      acc[month] = { month, income: 0, expense: 0 };
    }
    
    if (transaction.type === 'Expense') {
      acc[month].expense += transaction.amount;
    } else {
      acc[month].income += transaction.amount;
    }
    
    return acc;
  }, {} as Record<string, any>);

  const trendData = Object.values(monthlyTrends).sort((a: any, b: any) => 
    new Date(a.month + ' 1').getTime() - new Date(b.month + ' 1').getTime()
  );

  const exportReport = async (reportType: string) => {
    try {
      const data = reportService.generateReport(reportType, {
        financial,
        classReport,
        outstandingReport,
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Financial Reports & Analytics</h1>
            <p className="text-gray-600">Real-time financial tracking and analysis</p>
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
                <p className="text-xs opacity-75">{financial.feePayments.length} payments</p>
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
                <p className="text-xs opacity-75">{financial.currentYearIncome.length} records</p>
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
                <p className="text-xs opacity-75">{financial.feePayments.length + financial.currentYearIncome.length} records</p>
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
                <p className="text-xs opacity-75">{financial.currentYearExpenses.length} expenses</p>
              </div>
              <FileText className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card className={`bg-gradient-to-br ${financial.balance >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-orange-500 to-orange-600'} text-white`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Net Balance</p>
                <p className="text-2xl font-bold">GHS {financial.balance.toLocaleString()}</p>
                <p className="text-xs opacity-75">{financial.balance >= 0 ? 'Profit' : 'Loss'}</p>
              </div>
              <Calculator className="w-8 h-8 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {(categoryChartData.length > 0 || trendData.length > 0) && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {categoryChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Income vs Expenses by Category</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="income" fill="#10B981" name="Income" />
                    <Bar dataKey="expense" fill="#EF4444" name="Expense" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {trendData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Monthly Financial Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="income" stroke="#10B981" name="Income" />
                    <Line type="monotone" dataKey="expense" stroke="#EF4444" name="Expense" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Reports Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Class Financial Summary</CardTitle>
            <Button onClick={() => exportReport('class')} size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            {classReport.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Students</th>
                      <th className="text-left p-2">Expected</th>
                      <th className="text-left p-2">Collected</th>
                      <th className="text-left p-2">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classReport.map((cls, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{cls.className}</td>
                        <td className="p-2">{cls.enrolled}/{cls.capacity}</td>
                        <td className="p-2">GHS {cls.totalFeesExpected.toLocaleString()}</td>
                        <td className="p-2 text-green-600">GHS {cls.totalFeesCollected.toLocaleString()}</td>
                        <td className="p-2 text-red-600">GHS {cls.outstandingBalance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No class data available</p>
            )}
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
            {outstandingReport.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Student</th>
                      <th className="text-left p-2">Class</th>
                      <th className="text-left p-2">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingReport.slice(0, 10).map((student, index) => (
                      <tr key={index} className="border-b">
                        <td className="p-2">{student.studentName}</td>
                        <td className="p-2">{student.className}</td>
                        <td className="p-2 text-red-600 font-bold">GHS {student.outstanding.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">No outstanding balances</p>
            )}
            {outstandingReport.length > 10 && (
              <p className="text-sm text-gray-500 mt-2">
                Showing 10 of {outstandingReport.length} students with outstanding balances
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Financial Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {allTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Type</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-left p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {allTransactions
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 15)
                    .map((transaction, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-2">{new Date(transaction.date).toLocaleDateString()}</td>
                        <td className="p-2">
                          <span className={`px-2 py-1 rounded text-xs ${
                            transaction.type === 'Expense' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {transaction.type}
                          </span>
                        </td>
                        <td className="p-2">
                          {'source' in transaction ? transaction.source : 
                           'title' in transaction ? transaction.title : 
                           'Fee Payment'}
                        </td>
                        <td className={`p-2 font-bold ${
                          transaction.type === 'Expense' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'Expense' ? '-' : '+'}GHS {transaction.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">No transactions available</p>
          )}
        </CardContent>
      </Card>

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
            <Button onClick={() => exportReport('class')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Class Analysis
            </Button>
            <Button onClick={() => exportReport('outstanding')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Outstanding Report
            </Button>
            <Button onClick={() => exportReport('complete')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Complete Analysis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsModule;
