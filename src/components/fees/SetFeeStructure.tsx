import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Save, Pencil, Trash2 } from 'lucide-react';

const SetFeeStructure = () => {
  const { classes, addFeeStructure, updateFeeStructure, deleteFeeStructure, feeStructures } = useData();
  const { currentTerm, currentYear, isLoading } = useActiveTerm();
  const [formData, setFormData] = useState({
    classId: '',
    amount: '',
    dueDate: '',
    description: ''
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ amount: '', dueDate: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.classId || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please select a class and enter amount",
        variant: "destructive"
      });
      return;
    }

    if (!currentTerm || currentTerm === 'Not Set') {
      toast({
        title: "No Active Term",
        description: "Please set an active academic term in Settings first",
        variant: "destructive"
      });
      return;
    }

    const className = classes.find(c => c.id === formData.classId)?.className || '';
    
    setIsSubmitting(true);
    try {
      await addFeeStructure({
        classId: parseInt(formData.classId),
        className,
        term: currentTerm,
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate,
        description: formData.description
      });

      toast({
        title: "Fee Structure Set",
        description: `Fees set for ${className} - ${currentTerm}`,
      });

      setFormData({
        classId: '',
        amount: '',
        dueDate: '',
        description: ''
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to set fee structure",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fee: { id: string; amount: number; dueDate?: string; description?: string }) => {
    setEditingId(fee.id);
    setEditForm({
      amount: fee.amount.toString(),
      dueDate: fee.dueDate || '',
      description: fee.description || ''
    });
  };

  const handleEditSave = async () => {
    if (!editingId) return;
    setIsSubmitting(true);
    try {
      await updateFeeStructure(editingId, {
        amount: parseFloat(editForm.amount),
        dueDate: editForm.dueDate || undefined,
        description: editForm.description || undefined
      });
      toast({ title: 'Fee structure updated' });
      setEditingId(null);
    } catch {
      toast({ title: 'Error', description: 'Failed to update fee structure', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (fee: { id: string; className: string }) => {
    if (!confirm(`Delete fee structure for ${fee.className}?`)) return;
    setIsSubmitting(true);
    try {
      await deleteFeeStructure(fee.id);
      toast({ title: 'Fee structure deleted' });
    } catch (err: any) {
      toast({ title: 'Cannot delete', description: err?.message || 'Failed to delete', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentTermFees = feeStructures.filter(f =>
    !f.term ||
    f.term === currentTerm ||
    (typeof f.term === 'string' && f.term.includes(currentTerm))
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <span>Set Fee Structure</span>
            </div>
            <div className="text-sm text-gray-600 font-normal">
              Active Term: <span className="font-semibold">{currentTerm}</span> ({currentYear})
            </div>
          </CardTitle>
          <p className="text-sm text-gray-500">Fees are automatically tied to the current active term. Set the active term in Settings.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classId">Class *</Label>
                <Select value={formData.classId} onValueChange={(value) => handleInputChange('classId', value)} disabled={isLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className}
                      </SelectItem>
                    ))}
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

            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </span>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Set Fee Structure
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Current Fee Structures - Active Term Only */}
      <Card>
        <CardHeader>
          <CardTitle>Fee Structures - {currentTerm}</CardTitle>
          <p className="text-sm text-gray-500">Only structures for the active term are shown</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentTermFees.map((fee) => (
              <div key={fee.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{fee.className}</p>
                  <p className="text-sm text-gray-500">{fee.term || `${currentTerm} (legacy)`}</p>
                  {fee.description && <p className="text-sm text-gray-600">{fee.description}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="font-bold text-lg">GHS {fee.amount}</p>
                    {fee.dueDate && <p className="text-sm text-gray-500">Due: {fee.dueDate}</p>}
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(fee)} disabled={isSubmitting}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDelete(fee)} disabled={isSubmitting}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {currentTermFees.length === 0 && (
              <p className="text-center py-8 text-gray-500">No fee structures for {currentTerm}. Add one above.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={() => setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Fee Structure</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (GHS)</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm(f => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Due Date</Label>
              <Input
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm(f => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))}
                placeholder="e.g., Tuition fees"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(null)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SetFeeStructure;
