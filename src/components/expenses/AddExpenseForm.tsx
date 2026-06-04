
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { TrendingDown, Save } from 'lucide-react';

const AddExpenseForm = () => {
  const { addExpense, expenses } = useData();
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    amount: '',
    payeeName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    purpose: '',
    notes: ''
  });
  const [customCategory, setCustomCategory] = useState('');
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'category' && value !== 'Other') setCustomCategory('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = formData.category === 'Other' ? customCategory.trim() : formData.category.trim();
    
    if (!formData.title || !finalCategory || !formData.amount) {
      toast({
        title: "Validation Error",
        description: formData.category === 'Other' ? "Please fill in title, type the category, and enter amount" : "Please fill in title, category and amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      await addExpense({
        ...formData,
        category: finalCategory,
        amount: parseFloat(formData.amount)
      });

      toast({
        title: "Expense Added",
        description: `GHS ${formData.amount} expense for ${formData.title} recorded`,
      });

      setFormData({
        title: '',
        category: '',
        amount: '',
        payeeName: '',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        purpose: '',
        notes: ''
      });
      setCustomCategory('');
    } finally {
      setSaving(false);
    }
  };

  const defaultExpenseCategories = [
    'Salaries',
    'Utilities',
    'Supplies',
    'Maintenance',
    'Transport',
    'Food & Catering',
    'Books & Materials',
    'Equipment',
    'Training',
    'Marketing',
    'Insurance',
    'Rent',
    'Other'
  ];
  const expenseCategories = useMemo(() => {
    const saved = (expenses || [])
      .map((item) => item.category?.trim())
      .filter((category): category is string => Boolean(category));
    return Array.from(new Set([...defaultExpenseCategories.filter((c) => c !== 'Other'), ...saved, 'Other']));
  }, [expenses]);

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
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="e.g., Office supplies purchase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.category === 'Other' && (
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Type new expense category"
                  className="mt-2"
                  required
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (GHS) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleInputChange('amount', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payeeName">Payee Name</Label>
              <Input
                id="payeeName"
                value={formData.payeeName}
                onChange={(e) => handleInputChange('payeeName', e.target.value)}
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
                onChange={(e) => handleInputChange('paymentDate', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => handleInputChange('paymentMethod', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purpose">Purpose</Label>
            <Input
              id="purpose"
              value={formData.purpose}
              onChange={(e) => handleInputChange('purpose', e.target.value)}
              placeholder="Brief description of the expense purpose"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this expense..."
              rows={3}
            />
          </div>

          <div className="form-action-bar flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Fill in title, category, and amount to save.</p>
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
