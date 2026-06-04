
import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { TrendingUp, Save } from 'lucide-react';

const AddIncomeForm = () => {
  const { addIncome, income } = useData();
  const [formData, setFormData] = useState({
    source: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    receivedBy: 'Admin',
    notes: ''
  });
  const [customSource, setCustomSource] = useState('');
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    if (field === 'source' && value !== 'Other') setCustomSource('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalSource = formData.source === 'Other' ? customSource.trim() : formData.source.trim();
    
    if (!finalSource || !formData.amount) {
      toast({
        title: "Validation Error",
        description: formData.source === 'Other' ? "Please type the income source and amount" : "Please fill in source and amount",
        variant: "destructive"
      });
      return;
    }

    try {
      setSaving(true);
      await addIncome({
        ...formData,
        source: finalSource,
        amount: parseFloat(formData.amount)
      });

      toast({
        title: "Income Added",
        description: `GHS ${formData.amount} income from ${finalSource} recorded`,
      });

      setFormData({
        source: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMethod: 'Cash',
        receivedBy: 'Admin',
        notes: ''
      });
      setCustomSource('');
    } finally {
      setSaving(false);
    }
  };

  const defaultIncomeSources = [
    'Registration Fees',
    'Uniform Sales',
    'Book Sales',
    'Transport Fees',
    'Exam Fees',
    'Activity Fees',
    'Fundraising',
    'Donations',
    'Rental Income',
    'Other'
  ];
  const incomeSources = useMemo(() => {
    const saved = (income || [])
      .map((item) => item.source?.trim())
      .filter((source): source is string => Boolean(source));
    return Array.from(new Set([...defaultIncomeSources.filter((s) => s !== 'Other'), ...saved, 'Other']));
  }, [income]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="w-5 h-5" />
          <span>Add Other Income</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="source">Income Source *</Label>
              <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select income source" />
                </SelectTrigger>
                <SelectContent>
                  {incomeSources.map((source) => (
                    <SelectItem key={source} value={source}>
                      {source}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.source === 'Other' && (
                <Input
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  placeholder="Type new income source"
                  className="mt-2"
                  required
                />
              )}
            </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
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
            <Label htmlFor="receivedBy">Received By</Label>
            <Input
              id="receivedBy"
              value={formData.receivedBy}
              onChange={(e) => handleInputChange('receivedBy', e.target.value)}
              placeholder="Name of person who received the payment"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Additional notes about this income..."
              rows={3}
            />
          </div>

          <div className="form-action-bar flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">Fill in source and amount to save.</p>
            <Button type="submit" variant="primaryAction" className="min-h-10 w-full sm:w-auto" disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Add Income'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddIncomeForm;
