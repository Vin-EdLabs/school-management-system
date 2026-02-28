import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import useClasses from '@/hooks/useClasses';
import useFeeStructures, { useCreateFeeStructure, useUpdateFeeStructure, useDeleteFeeStructure } from '@/hooks/useFeeStructures';
import { DollarSign, Save, AlertCircle, Clock, Edit, Trash2, X, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import React, { useEffect, useMemo, useState } from 'react';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';
import { useActiveTerm } from '@/hooks/useSettings';

const SetFeeStructure = () => {
  const { toast } = useToast();
  const { classes: rawClasses } = useClasses();
  const { feeStructures } = useFeeStructures();
  const createFeeStructure = useCreateFeeStructure();
  const updateFeeStructure = useUpdateFeeStructure();
  const deleteFeeStructure = useDeleteFeeStructure();
  const { terms } = useAcademicTerms();
  const { data: activeTerm } = useActiveTerm();
  const hasActiveTerm = !!activeTerm;

  const [editingId, setEditingId] = useState<number | null>(null);

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || '')
  }));

  const [formData, setFormData] = useState({
    classLevel: '',
    termId: '',
    amount: '',
    dueDate: '',
    description: ''
  });

  useEffect(() => {
    if (activeTerm && !formData.termId && !editingId) {
      setFormData(prev => ({ ...prev, termId: String(activeTerm.id) }));
    }
  }, [activeTerm, editingId]);

  const getClassLevelLabel = (name: string) => {
    if (!name) return name;
    const sepIndex = name.search(/[-\/|:]/);
    if (sepIndex > -1) return name.slice(0, sepIndex).trim();
    const parts = name.trim().split(/\s+/);
    const last = parts[parts.length - 1];
    if (/^[A-Za-z]$/.test(last) || /^[0-9]+[A-Za-z]?$/.test(last) && /[A-Za-z]/.test(last)) {
      return parts.slice(0, -1).join(' ');
    }
    return name;
  };

  const uniqueLevels = useMemo(() => {
    const names = (classes || []).map(c => getClassLevelLabel(c.className)).filter(Boolean);
    return Array.from(new Set(names));
  }, [classes]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      classLevel: '',
      termId: activeTerm ? String(activeTerm.id) : '',
      amount: '',
      dueDate: '',
      description: ''
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.classLevel || !formData.amount || !formData.termId) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Duplicate check (only when creating or changing level/term)
    const normalizedLevel = formData.classLevel.trim();
    const termId = Number(formData.termId);

    const isDuplicate = feeStructures.some(fs =>
      fs.className === normalizedLevel &&
      Number(fs.term_id) === termId &&
      fs.id !== editingId
    );

    if (isDuplicate) {
      toast({
        title: "Duplicate Fee Structure",
        description: `A fee structure already exists for ${normalizedLevel} in the selected term. Please edit the existing one instead.`,
        variant: "destructive"
      });
      return;
    }

    const payload = {
      name: normalizedLevel,
      items: {
        amount: parseFloat(formData.amount),
        dueDate: formData.dueDate || null,
        description: formData.description || ''
      },
      term_id: termId,
      class_id: null
    };

    if (editingId) {
      updateFeeStructure.mutate({ id: editingId, payload }, {
        onSuccess: () => {
          toast({ title: "Updated", description: "Fee structure updated successfully" });
          resetForm();
        }
      });
    } else {
      createFeeStructure.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Success", description: `Fees set for ${formData.classLevel}` });
          resetForm();
        }
      });
    }
  };

  const handleEdit = (fee: any) => {
    setEditingId(fee.id);
    setFormData({
      classLevel: fee.className,
      termId: String(fee.term_id || ''),
      amount: String(fee.amount || ''),
      dueDate: fee.dueDate ? new Date(fee.dueDate).toISOString().split('T')[0] : '',
      description: fee.description || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this fee structure? This may affect student balances.")) {
      deleteFeeStructure.mutate(id, {
        onSuccess: () => {
          toast({ title: "Deleted", description: "Fee structure removed successfully" });
          if (editingId === id) resetForm();
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {!hasActiveTerm && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Academic Term</AlertTitle>
          <AlertDescription>
            You must have an active academic term before setting fee structures.
            Please go to <Link to="/dashboard/settings" className="font-bold underline">Settings</Link> to set an active term.
          </AlertDescription>
        </Alert>
      )}
      <Card className={editingId ? "border-indigo-200 shadow-indigo-100 shadow-lg" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-indigo-600" />
              <span>{editingId ? 'Edit Fee Structure' : 'Set Fee Structure'}</span>
            </div>
            {editingId && (
              <Button variant="ghost" size="sm" onClick={resetForm} className="text-muted-foreground">
                <X className="w-4 h-4 mr-1" /> Cancel Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classLevel">Class *</Label>
                <Select value={formData.classLevel} onValueChange={(value) => handleInputChange('classLevel', value)}>
                  <SelectTrigger className={editingId ? "border-indigo-200" : ""}>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueLevels.map(level => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="term">Term *</Label>
                <Select value={formData.termId} onValueChange={(value) => handleInputChange('termId', value)}>
                  <SelectTrigger className={editingId ? "border-indigo-200" : ""}>
                    <SelectValue placeholder="Select term" />
                  </SelectTrigger>
                  <SelectContent>
                    {terms.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} {t.year} {t.is_active ? '(Active)' : ''}
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
                  className={editingId ? "border-indigo-200 focus-visible:ring-indigo-200" : ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                  className={editingId ? "border-indigo-200 focus-visible:ring-indigo-200" : ""}
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
                className={editingId ? "border-indigo-200 focus-visible:ring-indigo-200" : ""}
              />
            </div>

            <div className="flex flex-col items-start space-y-2 pt-2">
              {!hasActiveTerm && <p className="text-sm text-red-500 font-medium font-outfit">Please set an active academic term in settings to set fee structures.</p>}
              <Button
                type="submit"
                className={`w-full md:w-auto ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                disabled={!hasActiveTerm || createFeeStructure.isPending || updateFeeStructure.isPending}
              >
                {editingId ? (
                  <><RefreshCw className={`w-4 h-4 mr-2 ${updateFeeStructure.isPending ? 'animate-spin' : ''}`} /> Update Fee Structure</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" /> Set Fee Structure</>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Current Fee Structures */}
      <Card className="border-none shadow-xl bg-muted/50/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <DollarSign className="w-5 h-5" />
            </div>
            Current Fee Structures
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...feeStructures].sort((a, b) => b.id - a.id).map((fee: any) => {
              const term = terms.find((t: any) => String(t.id) === String(fee.term_id));
              const amount = Number(fee.amount || 0);
              const dueDate = fee.dueDate;
              const description = fee.description;

              return (
                <div
                  key={fee.id}
                  className={`group relative bg-card border rounded-2xl p-5 hover:shadow-md transition-all duration-300 overflow-hidden ${editingId === fee.id ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-border'}`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/30 rounded-full -mr-12 -mt-12 group-hover:bg-indigo-50/50 transition-colors" />

                  <div className="relative flex justify-between items-start mb-4">
                    <div className="z-10">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-foreground group-hover:text-indigo-600 transition-colors">
                          {fee.className}
                        </h3>
                        <Badge variant="outline" className="bg-muted/50 text-muted-foreground border-border text-[10px] uppercase font-bold tracking-wider">
                          Level
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-none px-2 py-0 h-6">
                          {term ? `${term.name} ${term.year}` : 'Global Structure'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-right z-10">
                      <div className="text-2xl font-black text-indigo-600">
                        <span className="text-sm font-medium text-muted-foreground mr-1">GHS</span>
                        {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50"
                          onClick={() => handleEdit(fee)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(fee.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="relative flex flex-col gap-3">
                    {description && (
                      <p className="text-sm text-muted-foreground bg-muted/50 p-2.5 rounded-xl border border-dashed border-border line-clamp-2 italic">
                        "{description}"
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                      <div className="flex items-center text-muted-foreground">
                        {dueDate ? (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Due: {new Date(dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No due date set</span>
                        )}
                      </div>
                      <div className="text-muted-foreground">
                        Ref: #{fee.id.toString().padStart(4, '0')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {feeStructures.length === 0 && (
              <div className="col-span-full py-16 text-center bg-muted/50 border-2 border-dashed border-border rounded-2xl">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <DollarSign className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-muted-foreground">No fee structures set yet</h3>
                <p className="text-muted-foreground text-sm mt-1">Use the form above to configure fees for your classes.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetFeeStructure;
