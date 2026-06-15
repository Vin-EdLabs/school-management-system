
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, DollarSign, TrendingUp, Calculator } from 'lucide-react';
import { useFinancialSummary } from '@/hooks/useReportQueries';

const FinancialSummary = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { data: summary } = useFinancialSummary();

  const feesCollected = summary?.collected ?? 0;
  const otherIncome = summary?.otherIncome ?? 0;
  const openingBalance = summary?.totalOpeningBalance ?? 0;
  const totalCombinedIncome = feesCollected + otherIncome;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const balanceLeft =
    summary?.netBalance ?? openingBalance + totalCombinedIncome - totalExpenses;

  return (
    <Card className="overflow-hidden rounded-2xl border-purple-500/20 bg-purple-500/5 shadow-sm dark:bg-purple-500/10">
      <CardHeader className="px-6 py-5 pb-4">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2.5 text-base font-semibold text-purple-700 dark:text-purple-400">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/15">
              <Calculator className="h-4 w-4" />
            </div>
            <span>Financial Summary</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 px-6 pb-6 pt-0">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Combined Income</p>
                  <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    GHS {totalCombinedIncome.toLocaleString()}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Fees: GHS {feesCollected.toLocaleString()}</p>
                    <p>Other Income: GHS {otherIncome.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-muted-foreground">Balance Left</p>
                  <p
                    className={`mt-2 text-2xl font-bold tabular-nums ${
                      balanceLeft >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    GHS {balanceLeft.toLocaleString()}
                  </p>
                  <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                    <p>Opening: GHS {openingBalance.toLocaleString()}</p>
                    <p>Income: GHS {totalCombinedIncome.toLocaleString()}</p>
                    <p>Expenses: GHS {totalExpenses.toLocaleString()}</p>
                  </div>
                </div>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    balanceLeft >= 0 ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
                  }`}
                >
                  <DollarSign className="h-5 w-5" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <h4 className="mb-3 font-medium text-foreground">Financial Health</h4>
            <div className="flex items-center gap-2.5">
              <div
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  balanceLeft > totalCombinedIncome * 0.2
                    ? 'bg-emerald-500'
                    : balanceLeft > 0
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {balanceLeft > totalCombinedIncome * 0.2
                  ? 'Excellent — strong financial position'
                  : balanceLeft > 0
                    ? 'Good — positive balance maintained'
                    : 'Attention needed — expenses exceed income'}
              </span>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default FinancialSummary;
