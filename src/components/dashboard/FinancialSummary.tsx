
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, DollarSign, TrendingUp, Calculator } from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';

const FinancialSummary = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { payments, income, expenses } = useData();

  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  // Calculate fees collected (from payments - fee payments are NOT in income table)
  const feesCollected = payments
    .filter(payment => {
      const pt = payment.term || '';
      return pt === currentTerm || pt.includes(currentTerm) || currentTerm.includes(pt);
    })
    .reduce((sum, payment) => sum + payment.amount, 0);

  // Calculate other income (exclude fee payments - they are in payments)
  const otherIncome = income
    .filter(inc => inc.category !== 'Fee Payment')
    .filter(inc => {
      const incomeDate = new Date(inc.date);
      return incomeDate.getFullYear().toString() === currentYear;
    })
    .reduce((sum, inc) => sum + inc.amount, 0);

  // Calculate total combined income
  const totalCombinedIncome = feesCollected + otherIncome;

  // Calculate total expenses
  const totalExpenses = expenses
    .filter(expense => {
      const expenseDate = new Date(expense.paymentDate);
      const currentYear = new Date().getFullYear();
      return expenseDate.getFullYear() === currentYear;
    })
    .reduce((sum, expense) => sum + expense.amount, 0);

  // Calculate balance left
  const balanceLeft = totalCombinedIncome - totalExpenses;

  return (
    <Card className="bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/20 shadow-none">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-purple-700 dark:text-purple-400">
            <Calculator className="w-5 h-5" />
            <span>Financial Summary</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-500/10"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Total Combined Income */}
            <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Combined Income</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    GHS {totalCombinedIncome.toLocaleString()}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>Fees: GHS {feesCollected.toLocaleString()}</p>
                    <p>Other Income: GHS {otherIncome.toLocaleString()}</p>
                  </div>
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Balance Left */}
            <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Balance Left</p>
                  <p className={`text-2xl font-bold ${balanceLeft >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    GHS {balanceLeft.toLocaleString()}
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>Income: GHS {totalCombinedIncome.toLocaleString()}</p>
                    <p>Expenses: GHS {totalExpenses.toLocaleString()}</p>
                  </div>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  balanceLeft >= 0 ? 'bg-blue-500/10' : 'bg-red-500/10'
                }`}>
                  <DollarSign className={`w-6 h-6 ${balanceLeft >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`} />
                </div>
              </div>
            </div>
          </div>

          {/* Financial Health Indicator */}
          <div className="bg-card rounded-lg p-4 border border-border shadow-sm">
            <h4 className="font-medium text-foreground mb-2">Financial Health</h4>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                balanceLeft > totalCombinedIncome * 0.2 ? 'bg-emerald-500' :
                balanceLeft > 0 ? 'bg-amber-500' : 'bg-red-500'
              }`}></div>
              <span className="text-sm text-muted-foreground">
                {balanceLeft > totalCombinedIncome * 0.2 ? 'Excellent - Strong financial position' :
                 balanceLeft > 0 ? 'Good - Positive balance maintained' : 
                 'Attention needed - Expenses exceed income'}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default FinancialSummary;
