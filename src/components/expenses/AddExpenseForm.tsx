
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { TrendingDown, Save } from 'lucide-react';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import BudgetCategorySelect, { persistBudgetCategory } from '../common/BudgetCategorySelect';
import { isReservedCategoryName } from '../../constants/financeCategories';
import { useBudgetCategories } from '../../hooks/useBudgetCategories';

const AddExpenseForm = () => {
  const { addExpense } = useData();
  const { refresh: refreshCategories } = useBudgetCategories('expense');
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    amount: '',
    payeeName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentAccountId: '',
    purpose: '',
    notes: ''
  });
  const [saving, setSaving] = useState(false);
  const [categorySelectKey, setCategorySelectKey] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = formData.category.trim();
    
    if (!formData.title || !finalCategory || !formData.amount || isReservedCategoryName(finalCategory)) {
      toast({
        title: "Validation Error",
        description: isReservedCategoryName(finalCategory)
          ? "Please type a category name under Other"
          : "Please fill in title, category and amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      await persistBudgetCategory('expense', finalCategory);
      await addExpense({
        ...formData,
        category: finalCategory,
        amount: parseFloat(formData.amount)
      });

      await refreshCategories();

      toast({
        title: "Expense Added",
        description: `GHS ${formData.amount} recorded under ${finalCategory}. Budget updated automatically.`,
      });

      setFormData({
        title: '',
        category: '',
        amount: '',
        payeeName: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        paymentAccountId: '',
        purpose: '',
        notes: ''
      });
      setCategorySelectKey((k) => k + 1);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingDown className="w-5 h-5" />
          <span>Add Expense</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Expense Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Office supplies purchase"
                required
              />
            </div>
            <BudgetCategorySelect
              key={categorySelectKey}
              type="expense"
              id="category"
              label="Category *"
              value={formData.category}
              onChange={(category) => setFormData((prev) => ({ ...prev, category }))}
              disabled={saving}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (GHS) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payeeName">Payee Name</Label>
              <Input
                id="payeeName"
                value={formData.payeeName}
                onChange={(e) => setFormData((prev) => ({ ...prev, payeeName: e.target.value }))}
                placeholder="Person or company paid"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Payment Date</Label>
              <Input
                id="paymentDate"
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentDate: e.target.value }))}
                required
              />
            </div>
            <PaymentAccountSelect
              value={formData.paymentAccountId}
              onChange={(accountId, paymentMethod) =>
                setFormData((prev) => ({ ...prev, paymentAccountId: accountId, paymentMethod }))
              }
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input
              id="purpose"
              value={formData.purpose}
              onChange={(e) => setFormData((prev) => ({ ...prev, purpose: e.target.value }))}
              placeholder="Brief description of the expense purpose"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Additional notes about this expense..."
              rows={3}
            />
          </div>

          <div className="form-action-bar flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Pick a category from the list, or choose Other and type a new one — it will appear in the list next time.
            </p>
            <Button type="submit" variant="primaryAction" className="min-h-10 w-full sm:w-auto" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Add Expense'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddExpenseForm;
