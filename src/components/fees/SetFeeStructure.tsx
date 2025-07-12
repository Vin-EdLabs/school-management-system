import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Save } from 'lucide-react';

const SetFeeStructure = () => {
  const { classes, addFeeStructure, feeStructures } = useData();
  const [formData, setFormData] = useState({
    className: '',
    term: 'Term 1 2024',
    amount: '',
    dueDate: '',
    description: ''
  });

  console.log('SetFeeStructure: classes data:', classes);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.className || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please select a class and enter amount",
        variant: "destructive"
      });
      return;
    }

    addFeeStructure({
      ...formData,
      amount: parseFloat(formData.amount)
    });

    toast({
      title: "Fee Structure Set",
      description: `Fees set for ${formData.className}`,
    });

    setFormData({
      className: '',
      term: 'Term 1 2024',
      amount: '',
      dueDate: '',
      description: ''
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <DollarSign className="w-5 h-5" />
            <span>Set Fee Structure</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="className">Class *</Label>
                <Select value={formData.className} onValueChange={(value) => handleInputChange('className', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => {
                      console.log('SetFeeStructure: rendering class item:', cls.className);
                      return (
                        <SelectItem key={cls.id} value={cls.className}>
                          {cls.className}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term</Label>
                <Select value={formData.term} onValueChange={(value) => handleInputChange('term', value)}>
                  <SelectTrigger>
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
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="e.g., Tuition fees for the term"
              />
            </div>

            <Button type="submit" className="w-full md:w-auto">
              <Save className="w-4 h-4 mr-2" />
              Set Fee Structure
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Fee Structures */}
      <Card>
        <CardHeader>
          <CardTitle>Current Fee Structures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {feeStructures.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{fee.className}</p>
                  <p className="text-sm text-gray-500">{fee.term}</p>
                  {fee.description && <p className="text-sm text-gray-600">{fee.description}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg">GHS {fee.amount}</p>
                  {fee.dueDate && <p className="text-sm text-gray-500">Due: {fee.dueDate}</p>}
                </div>
              </div>
            ))}
            {feeStructures.length === 0 && (
              <p className="text-center py-8 text-gray-500">No fee structures set yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetFeeStructure;
