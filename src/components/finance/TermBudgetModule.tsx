import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { toast } from '@/hooks/use-toast';
import { useFinanceRealtime } from '../../hooks/useFinanceRealtime';
import {
  addBudgetCategory,
  closeTermBudget,
  createTermBudget,
  fetchBudgetHistory,
  fetchCurrentBudget,
  fetchSetupPrefill,
  updateTermBudgetLines,
  type BudgetLine,
  type SetupPrefill,
  type TermBudgetView,
} from '../../services/termBudgetApi';
import { formatCategoryActualLabel, getCategoryDisplayName } from '../../utils/budgetCategories';
import {
  AlertTriangle,
  Archive,
  Copy,
  PiggyBank,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import './TermBudgetModule.css';

function formatGhs(value: number) {
  return `GHS ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function progressColor(pct: number) {
  if (pct >= 100) return 'red';
  if (pct >= 90) return 'orange';
  if (pct >= 75) return 'yellow';
  return 'green';
}

function varianceLabel(remaining: number, isExpense: boolean) {
  if (Math.abs(remaining) < 0.01) return 'On budget';
  if (isExpense) {
    return remaining >= 0
      ? `Under budget by ${formatGhs(remaining)}`
      : `Over budget by ${formatGhs(Math.abs(remaining))}`;
  }
  return remaining >= 0
    ? `Below target by ${formatGhs(remaining)}`
    : `Above target by ${formatGhs(Math.abs(remaining))}`;
}

const TermBudgetModule = () => {
  const { user } = useAuth();
  const { currentTerm, currentYear } = useActiveTerm();
  const canClose = user?.role === 'administrator' || user?.role === 'super-admin';

  const [loading, setLoading] = useState(true);
  const [budget, setBudget] = useState<TermBudgetView | null>(null);
  const [history, setHistory] = useState<Array<Record<string, unknown>>>([]);
  const [mode, setMode] = useState<'view' | 'setup' | 'edit'>('view');
  const [setupStep, setSetupStep] = useState<'choose' | 'form'>('choose');
  const [prefill, setPrefill] = useState<SetupPrefill | null>(null);
  const [draftLines, setDraftLines] = useState<BudgetLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [categoryDialog, setCategoryDialog] = useState<{ open: boolean; type: 'income' | 'expense' }>({
    open: false,
    type: 'income',
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [current, hist] = await Promise.all([fetchCurrentBudget(), fetchBudgetHistory()]);
      setBudget(current);
      setHistory(hist || []);
      if (!current) {
        setMode('setup');
        setSetupStep('choose');
      } else if (mode === 'setup') {
        setMode('view');
      }
    } catch (err: unknown) {
      toast({
        title: 'Failed to load budget',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useFinanceRealtime({ onInvalidate: reload });

  useEffect(() => {
    void reload();
  }, [reload]);

  const incomeLines = useMemo(
    () => (budget?.lines || draftLines).filter((l) => l.categoryType === 'income'),
    [budget, draftLines]
  );
  const expenseLines = useMemo(
    () => (budget?.lines || draftLines).filter((l) => l.categoryType === 'expense'),
    [budget, draftLines]
  );

  const startSetup = async (copyFromLast: boolean) => {
    try {
      setLoading(true);
      const data = await fetchSetupPrefill(copyFromLast);
      setPrefill(data);
      setDraftLines([...data.incomeLines, ...data.expenseLines]);
      setSetupStep('form');
      setMode('setup');
    } catch (err: unknown) {
      toast({
        title: 'Setup failed',
        description: err instanceof Error ? err.message : 'Could not load prefill',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDraftAmount = (categoryName: string, categoryType: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setDraftLines((prev) =>
      prev.map((l) =>
        l.categoryName === categoryName && l.categoryType === categoryType
          ? { ...l, budgetedAmount: amount }
          : l
      )
    );
  };

  const handleSaveNewBudget = async () => {
    try {
      setSaving(true);
      const created = await createTermBudget(draftLines);
      setBudget(created);
      setMode('view');
      toast({ title: 'Budget saved', description: `Term budget active for ${currentTerm} ${currentYear}` });
    } catch (err: unknown) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Could not save budget',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!budget) return;
    try {
      setSaving(true);
      const updated = await updateTermBudgetLines(
        budget.budget.id,
        draftLines
          .filter((l) => l.id != null)
          .map((l) => ({
            id: l.id!,
            budgetedAmount: l.budgetedAmount,
            alertThreshold: l.alertThreshold ?? 90,
          }))
      );
      setBudget(updated);
      setMode('view');
      toast({ title: 'Budget updated', description: 'Changes saved and logged in audit trail.' });
    } catch (err: unknown) {
      toast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Could not update budget',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseBudget = async () => {
    if (!budget || !canClose) return;
    if (!window.confirm('Close this term budget? It will be archived and no further edits allowed.')) return;
    try {
      setSaving(true);
      const closed = await closeTermBudget(budget.budget.id);
      setBudget(closed);
      toast({ title: 'Budget closed', description: 'This term budget is now archived.' });
    } catch (err: unknown) {
      toast({
        title: 'Close failed',
        description: err instanceof Error ? err.message : 'Could not close budget',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!budget) return;
    setDraftLines(budget.lines.map((l) => ({ ...l })));
    setMode('edit');
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    try {
      await addBudgetCategory(name, categoryDialog.type);
      if (mode === 'setup' || mode === 'edit') {
        setDraftLines((prev) => [
          ...prev,
          { categoryName: name, categoryType: categoryDialog.type, budgetedAmount: 0, alertThreshold: 90 },
        ]);
      }
      setNewCategoryName('');
      setCategoryDialog({ open: false, type: 'income' });
      toast({ title: 'Category added', description: `"${name}" is now available in budget and recording forms.` });
    } catch (err: unknown) {
      toast({
        title: 'Failed to add category',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const renderLineRow = (line: BudgetLine, editable: boolean, isExpense: boolean) => {
    const pct = line.percentageUsed ?? (line.budgetedAmount > 0 ? 0 : 0);
    const actual = line.actualAmount ?? 0;
    const remaining = line.remaining ?? line.budgetedAmount - actual;
    const color = progressColor(pct);
    const alertLevel = line.alertLevel;

    return (
      <div key={`${line.categoryType}-${line.categoryName}`} className="term-budget-line-row">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{getCategoryDisplayName(line.categoryName)}</span>
            {alertLevel && alertLevel !== 'none' && (
              <span className={`term-budget-alert-badge ${alertLevel}`}>
                {alertLevel === 'warning' && '🟡'}
                {alertLevel === 'critical' && '🟠'}
                {alertLevel === 'exceeded' && '🔴'}
                {alertLevel}
              </span>
            )}
          </div>
          {!editable && (
            <p className="text-xs text-muted-foreground mt-0.5">{varianceLabel(remaining, isExpense)}</p>
          )}
        </div>
        <div>
          {editable ? (
            <Input
              type="number"
              step="0.01"
              min="0"
              value={line.budgetedAmount}
              onChange={(e) => updateDraftAmount(line.categoryName, line.categoryType, e.target.value)}
            />
          ) : (
            <p className="text-sm font-semibold">{formatGhs(line.budgetedAmount)}</p>
          )}
          <p className="text-[10px] text-muted-foreground">Budgeted</p>
        </div>
        <div>
          <p className="text-sm font-semibold">{formatGhs(actual)}</p>
          <p className="text-[10px] text-muted-foreground">Actual</p>
        </div>
        <div>
          <p className={`text-sm font-semibold ${remaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {formatGhs(remaining)}
          </p>
          <p className="text-[10px] text-muted-foreground">Remaining</p>
        </div>
        <div>
          {!editable && line.budgetedAmount > 0 && (
            <>
              <div className="term-budget-progress">
                <div
                  className={`term-budget-progress-bar ${color}`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">{pct.toFixed(0)}% used</p>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderCategoryBreakdown = (lines: BudgetLine[], type: 'income' | 'expense', title: string) => {
    const sorted = [...lines].sort((a, b) => (b.actualAmount ?? 0) - (a.actualAmount ?? 0));
    return (
      <div className="term-budget-breakdown">
        <h4 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h4>
        <ul className="space-y-2">
          {sorted.map((line) => (
            <li
              key={`${line.categoryType}-${line.categoryName}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
            >
              <span className="text-sm font-medium">
                {formatCategoryActualLabel(line.categoryName, line.actualAmount ?? 0, type)}
              </span>
              {line.budgetedAmount > 0 && (
                <span className="text-xs text-muted-foreground">
                  of {formatGhs(line.budgetedAmount)} budgeted
                </span>
              )}
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="text-sm text-muted-foreground px-1">No categories yet.</li>
          )}
        </ul>
      </div>
    );
  };

  const renderSection = (
    title: string,
    lines: BudgetLine[],
    editable: boolean,
    isExpense: boolean,
    note?: string
  ) => (
    <div className="term-budget-section">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {note && <p className="term-budget-note">{note}</p>}
        </div>
        {editable && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCategoryDialog({ open: true, type: isExpense ? 'expense' : 'income' });
            }}
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Custom {isExpense ? 'Expense' : 'Income'} Category
          </Button>
        )}
      </div>
      <div className="hidden md:grid term-budget-line-row text-xs font-semibold text-muted-foreground border-b pb-2">
        <span>Category</span>
        <span>Budgeted</span>
        <span>Actual</span>
        <span>Remaining</span>
        <span>Progress</span>
      </div>
      {lines.map((line) => renderLineRow(line, editable, isExpense))}
    </div>
  );

  if (loading && !budget && mode === 'view') {
    return (
      <div className="term-budget-module p-8 text-center text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
        Loading term budget…
      </div>
    );
  }

  return (
    <div className="term-budget-module">
      <div className="term-budget-header">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <PiggyBank className="w-7 h-7 text-emerald-600" />
            Term Budget
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {currentTerm} · {currentYear}
            {budget && (
              <Badge variant={budget.budget.status === 'active' ? 'default' : 'secondary'} className="ml-2">
                {budget.budget.status}
              </Badge>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {budget?.budget.status === 'active' && mode === 'view' && (
            <Button variant="outline" size="sm" onClick={openEdit}>
              Edit Budget
            </Button>
          )}
          {budget?.budget.status === 'active' && canClose && mode === 'view' && (
            <Button variant="destructive" size="sm" onClick={() => void handleCloseBudget()} disabled={saving}>
              <Archive className="w-4 h-4 mr-1" />
              Close Term
            </Button>
          )}
          {!budget && mode !== 'setup' && (
            <Button variant="primaryAction" size="sm" onClick={() => { setMode('setup'); setSetupStep('choose'); }}>
              Set Budget
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          {mode === 'setup' && setupStep === 'choose' && (
            <Card>
              <CardHeader>
                <CardTitle>Set Term Budget</CardTitle>
                <CardDescription>
                  Create a budget for {currentTerm} {currentYear}. Choose how to start.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="term-budget-setup-choice">
                  <button
                    type="button"
                    className="rounded-xl border-2 border-border p-6 text-left hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors"
                    onClick={() => void startSetup(false)}
                  >
                    <Sparkles className="w-8 h-8 text-emerald-600 mb-3" />
                    <p className="font-semibold">Start Fresh</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Blank form with auto-filled fee income and salaries only.
                    </p>
                  </button>
                  <button
                    type="button"
                    className="rounded-xl border-2 border-border p-6 text-left hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-colors"
                    onClick={() => void startSetup(true)}
                  >
                    <Copy className="w-8 h-8 text-indigo-600 mb-3" />
                    <p className="font-semibold">Copy From Last Term</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pre-fill all amounts from the previous term budget.
                    </p>
                  </button>
                </div>
              </CardContent>
            </Card>
          )}

          {(mode === 'setup' && setupStep === 'form') || mode === 'edit' ? (
            <Card>
              <CardHeader>
                <CardTitle>{mode === 'edit' ? 'Edit Active Budget' : 'New Term Budget'}</CardTitle>
                {mode === 'edit' && (
                  <div className="term-budget-edit-warning flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    You are editing an active budget. All changes are logged.
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {renderSection(
                  'Income Budget',
                  draftLines.filter((l) => l.categoryType === 'income'),
                  true,
                  false,
                  prefill ? `Expected Fee Income auto-filled: ${formatGhs(prefill.expectedFeeIncome)}` : undefined
                )}
                {renderSection(
                  'Expense Budget',
                  draftLines.filter((l) => l.categoryType === 'expense'),
                  true,
                  true,
                  prefill?.salaryAutoFill?.note
                )}
                <div className="flex justify-end gap-2 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (mode === 'edit') {
                        setMode('view');
                      } else {
                        setSetupStep('choose');
                      }
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primaryAction"
                    disabled={saving}
                    onClick={() => void (mode === 'edit' ? handleSaveEdits() : handleSaveNewBudget())}
                  >
                    <Save className="w-4 h-4 mr-1" />
                    {saving ? 'Saving…' : 'Save Budget'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {budget && mode === 'view' && (
            <>
              <div className="term-budget-summary-grid">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Income</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="term-budget-card-value">{formatGhs(budget.summary.totalActualIncome)}</p>
                    <p className="text-xs text-muted-foreground">
                      of {formatGhs(budget.summary.totalBudgetedIncome)} budgeted
                    </p>
                    <p
                      className={`text-xs mt-1 term-budget-variance ${
                        budget.summary.incomeVariance >= 0 ? 'positive' : 'negative'
                      }`}
                    >
                      Variance: {formatGhs(Math.abs(budget.summary.incomeVariance))}{' '}
                      {budget.summary.incomeVariance >= 0 ? 'below target' : 'above target'}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Expenses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="term-budget-card-value">{formatGhs(budget.summary.totalActualExpense)}</p>
                    <p className="text-xs text-muted-foreground">
                      of {formatGhs(budget.summary.totalBudgetedExpense)} budgeted
                    </p>
                    <p
                      className={`text-xs mt-1 term-budget-variance ${
                        budget.summary.expenseVariance >= 0 ? 'positive' : 'negative'
                      }`}
                    >
                      {budget.summary.expenseVariance >= 0 ? 'Under' : 'Over'} budget by{' '}
                      {formatGhs(Math.abs(budget.summary.expenseVariance))}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Net Position</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="term-budget-card-value">
                      {formatGhs(budget.summary.netActualPosition)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Budget net: {formatGhs(budget.summary.netBudgetPosition)}
                    </p>
                    <p className="text-xs mt-1">
                      {budget.summary.netActualPosition >= budget.summary.netBudgetPosition
                        ? 'Surplus vs budget'
                        : 'Deficit vs budget'}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">By category</CardTitle>
                  <CardDescription>
                    Drill down into what was collected and spent this term
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 md:grid-cols-2">
                  {renderCategoryBreakdown(incomeLines, 'income', 'Income collected')}
                  {renderCategoryBreakdown(expenseLines, 'expense', 'Expenses spent')}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Detailed tracking</CardTitle>
                  <CardDescription>Budgeted vs actual with progress bars</CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {renderSection('Income Categories', incomeLines, false, false)}
                  {renderSection('Expense Categories', expenseLines, false, true)}
                </CardContent>
              </Card>
            </>
          )}

          {!budget && mode === 'view' && (
            <Card>
              <CardContent className="py-12 text-center">
                <PiggyBank className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="font-semibold">No budget set for this term</p>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Set a term budget to track income and expenses with real-time alerts.
                </p>
                <Button variant="primaryAction" onClick={() => { setMode('setup'); setSetupStep('choose'); }}>
                  Set Budget
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Budget History</CardTitle>
              <CardDescription>Archived and closed term budgets</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No budget history yet.</p>
              ) : (
                <div className="space-y-3">
                  {history.map((h) => (
                    <div
                      key={String(h.id)}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div>
                        <p className="font-medium">
                          {String(h.term)} · {String(h.academic_year)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Income: {formatGhs(Number(h.total_income || 0))} · Expense:{' '}
                          {formatGhs(Number(h.total_expense || 0))}
                        </p>
                      </div>
                      <Badge variant={h.status === 'closed' ? 'secondary' : 'default'}>
                        {String(h.status)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={categoryDialog.open} onOpenChange={(open) => setCategoryDialog((p) => ({ ...p, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={categoryDialog.type}
                onValueChange={(v) => setCategoryDialog((p) => ({ ...p, type: v as 'income' | 'expense' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category name</Label>
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. PTA Donations"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog({ open: false, type: 'income' })}>
              Cancel
            </Button>
            <Button variant="primaryAction" onClick={() => void handleAddCategory()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TermBudgetModule;
