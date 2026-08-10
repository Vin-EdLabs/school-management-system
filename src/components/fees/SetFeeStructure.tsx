import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { toast } from '@/hooks/use-toast';
import { DollarSign, Pencil, Trash2, UserPlus, Archive, PlusCircle, BedDouble } from 'lucide-react';
import { apiService } from '../../services/api';
import FeeStructureItemsForm, { validateFeeStructureItemsForm } from './FeeStructureItemsForm';
import TermBillBreakdown from './TermBillBreakdown';
import BillStudentModal from './BillStudentModal';
import ArchivedFeeStructurePanel from './ArchivedFeeStructurePanel';
import BoardingFeeSetupPanel from './BoardingFeeSetupPanel';
import {
  saveFeeStructureItems,
  type FeeStructureItem,
} from '../../services/feeStructureItems';
import { feeStructureMatchesActiveTerm } from '../../utils/termLabelMatch';
import { useSchool } from '../../contexts/SchoolContext';

const SetFeeStructure = () => {
  const queryClient = useQueryClient();
  const { school } = useSchool();
  const boardingModuleEnabled = Boolean(school?.boarding_enabled);
  const { classes, updateFeeStructure, deleteFeeStructure, feeStructures, refresh } = useData();
  const { currentTerm, currentYear, isLoading, activeLedgerTermId, refresh: refreshActiveTerm } = useActiveTerm();
  const [formData, setFormData] = useState({
    classId: '',
    dueDate: '',
    description: '',
  });
  const [feeItems, setFeeItems] = useState<FeeStructureItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingFee, setEditingFee] = useState<{ className: string; term: string } | null>(null);
  const [editForm, setEditForm] = useState({ dueDate: '', description: '' });
  const [editItems, setEditItems] = useState<FeeStructureItem[]>([]);
  const [editItemsTotal, setEditItemsTotal] = useState(0);
  const [editItemErrors, setEditItemErrors] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [billModalOpen, setBillModalOpen] = useState(false);
  const [setupMode, setSetupMode] = useState<'new' | 'reuse'>('new');
  const [boardingFeeDialogOpen, setBoardingFeeDialogOpen] = useState(false);

  const handleFeesRefreshed = async () => {
    await Promise.all([refresh(['fees']), refreshActiveTerm()]);
    void queryClient.invalidateQueries({ queryKey: ['fee-structure-check'] });
  };

  useEffect(() => {
    if (activeLedgerTermId != null) {
      void refresh(['fees']);
    }
  }, [activeLedgerTermId, refresh]);

  const openBillStudent = () => {
    setBillModalOpen(true);
  };

  const handleItemsChange = useCallback((items: FeeStructureItem[], total: number) => {
    setFeeItems(items);
    setItemsTotal(total);
  }, []);

  const handleEditItemsChange = useCallback((items: FeeStructureItem[], total: number) => {
    setEditItems(items);
    setEditItemsTotal(total);
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.classId) {
      toast({ title: 'Validation Error', description: 'Please select a class', variant: 'destructive' });
      return;
    }

    if (isDailyFeeClass(formData.classId)) {
      toast({
        title: 'Daily fee class',
        description: 'This class uses Daily Fees. Set its structure under Finance → Daily Fees.',
        variant: 'destructive',
      });
      return;
    }

    const validationErrors = validateFeeStructureItemsForm(feeItems);
    if (Object.keys(validationErrors).length > 0) {
      setItemErrors(validationErrors);
      toast({ title: 'Validation Error', description: 'Fix the highlighted fee amounts before saving', variant: 'destructive' });
      return;
    }
    setItemErrors({});

    if (!currentTerm || currentTerm === 'Not Set') {
      toast({
        title: 'No Active Term',
        description: 'Please set an active academic term in Settings first',
        variant: 'destructive',
      });
      return;
    }

    const className = classes.find(c => c.id === formData.classId)?.className || '';
    const duplicate = feeStructures.some((f) => {
      const feeClassId = f.classId ?? (f as { class_id?: number }).class_id;
      if (String(feeClassId) !== String(formData.classId)) return false;
      return feeStructureMatchesActiveTerm(
        f.term,
        currentTerm,
        currentYear,
        f.termId,
        activeLedgerTermId
      );
    });
    if (duplicate) {
      toast({
        title: 'Already exists',
        description: `A fee structure for ${className} already exists for ${currentTerm}. Edit it from the list below.`,
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await apiService.post<{ id: string | number }>('/fees', {
        class_id: parseInt(formData.classId, 10),
        term: currentTerm,
        amount: itemsTotal,
        due_date: formData.dueDate,
        description: formData.description,
      });
      const structureId = String(created.id);
      const saved = await saveFeeStructureItems(structureId, feeItems);

      void queryClient.invalidateQueries({ queryKey: ['fee-structure-check'] });

      toast({
        title: 'Fee structure saved',
        description: `Total Term Bill: GHS ${saved.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });

      setFormData({ classId: '', dueDate: '', description: '' });
      setFeeItems([]);
      setItemsTotal(0);
      await Promise.all([refresh(['fees']), refreshActiveTerm()]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to set fee structure';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (fee: { id: string; className: string; term?: string; dueDate?: string; description?: string }) => {
    setEditingId(fee.id);
    setEditingFee({ className: fee.className, term: fee.term || currentTerm });
    setEditForm({
      dueDate: fee.dueDate || '',
      description: fee.description || '',
    });
    setEditItemErrors({});
  };

  const handleEditSave = async () => {
    if (!editingId) return;

    const validationErrors = validateFeeStructureItemsForm(editItems);
    if (Object.keys(validationErrors).length > 0) {
      setEditItemErrors(validationErrors);
      toast({ title: 'Validation Error', description: 'Fix the highlighted fee amounts before saving', variant: 'destructive' });
      return;
    }
    setEditItemErrors({});

    setIsSubmitting(true);
    try {
      const saved = await saveFeeStructureItems(editingId, editItems);
      await updateFeeStructure(editingId, {
        amount: saved.total,
        dueDate: editForm.dueDate || undefined,
        description: editForm.description || undefined,
      });
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-check'] });
      toast({
        title: 'Fee structure saved',
        description: `Total Term Bill: GHS ${saved.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      });
      setEditingId(null);
      setEditingFee(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update fee structure';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (fee: { id: string; className: string }) => {
    if (!confirm(`Delete fee structure for ${resolveFeeClassLabel(fee)}?`)) return;
    setIsSubmitting(true);
    try {
      await deleteFeeStructure(fee.id);
      void queryClient.invalidateQueries({ queryKey: ['fee-structure-check'] });
      toast({ title: 'Fee structure deleted' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete';
      toast({ title: 'Cannot delete', description: message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const termFeeClasses = classes.filter(
    (cls) => cls.feeMode !== 'daily' && cls.className && cls.className.trim() !== ''
  );

  const isDailyFeeClass = (classId: number | string | undefined) => {
    if (classId == null) return false;
    const cls = classes.find((c) => String(c.id) === String(classId));
    return cls?.feeMode === 'daily';
  };

  const currentTermFees = feeStructures.filter((f) => {
    if (isDailyFeeClass(f.classId ?? (f as { class_id?: number }).class_id)) return false;
    return feeStructureMatchesActiveTerm(
      f.term,
      currentTerm,
      currentYear,
      f.termId,
      activeLedgerTermId
    );
  });

  const configuredClassIds = new Set(
    currentTermFees.map((f) => String(f.classId ?? (f as { class_id?: number }).class_id))
  );

  const unsetTermFeeClasses = termFeeClasses.filter((cls) => !configuredClassIds.has(String(cls.id)));

  const resolveFeeClassLabel = (fee: { className?: string; classId?: number; class_id?: number }) => {
    const classId = fee.classId ?? fee.class_id;
    const cls = classId != null ? classes.find((c) => String(c.id) === String(classId)) : undefined;
    if (cls) {
      const levelNote = cls.level ? ` · ${cls.level}` : '';
      return `${cls.className}${levelNote}`;
    }
    return fee.className || 'Unknown class';
  };

  const selectedClassLabel = formData.classId
    ? classes.find(c => c.id === formData.classId)?.className || 'Selected class'
    : 'Select a class';

  return (
    <div className="space-y-6">
      {boardingModuleEnabled ? (
        <BoardingFeeSetupPanel
          currentTerm={currentTerm}
          dialogOpen={boardingFeeDialogOpen}
          onDialogOpenChange={setBoardingFeeDialogOpen}
        />
      ) : null}

      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30 pb-4">
          <CardTitle className="text-base font-semibold">Set up fees for {currentTerm}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Choose how to assign fee structures for the active term ({currentYear}). Fees never carry over automatically.
          </p>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,280px)_1fr] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="fee-setup-mode">Setup method</Label>
              <Select
                value={setupMode}
                onValueChange={(v) => setSetupMode(v as 'new' | 'reuse')}
              >
                <SelectTrigger id="fee-setup-mode" className="h-11">
                  <SelectValue placeholder="Choose setup method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">
                    <span className="inline-flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-emerald-600" />
                      Create new structure (manual)
                    </span>
                  </SelectItem>
                  <SelectItem value="reuse">
                    <span className="inline-flex items-center gap-2">
                      <Archive className="h-4 w-4 text-emerald-600" />
                      Reuse previous term fee setup
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground md:pb-2">
              {setupMode === 'new'
                ? 'Set amounts class by class for this term only.'
                : 'Copy fee structures from a previous term — billing is optional when you confirm.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {setupMode === 'reuse' ? (
        <ArchivedFeeStructurePanel currentTerm={currentTerm} onReused={handleFeesRefreshed} />
      ) : (
      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="w-5 h-5" />
              <span>Set Fee Structure</span>
            </div>
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                {boardingModuleEnabled ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full border-emerald-500 text-emerald-700 hover:border-emerald-600 hover:bg-emerald-50"
                    onClick={() => setBoardingFeeDialogOpen(true)}
                  >
                    <BedDouble className="mr-2 h-4 w-4" />
                    Set boarding fee
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bill-student-button rounded-full border-emerald-500 text-emerald-600 hover:border-emerald-600 hover:text-emerald-700"
                  onClick={openBillStudent}
                >
                  <span className="bill-student-orbit-dot" />
                  <UserPlus className="mr-2 h-4 w-4" />
                  Bill Student
                </Button>
              </div>
              <p className="text-sm text-muted-foreground font-normal text-right">
                Active Term: <span className="font-semibold text-foreground">{currentTerm}</span> ({currentYear})
              </p>
            </div>
          </CardTitle>
          <p className="text-sm text-muted-foreground">Fees are automatically tied to the current active term. Set the active term in Settings.</p>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="classId">Class *</Label>
              <Select value={formData.classId} onValueChange={(value) => handleInputChange('classId', value)} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {unsetTermFeeClasses.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      All term-fee classes are configured
                    </SelectItem>
                  ) : (
                    unsetTermFeeClasses.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className}{cls.level ? ` (${cls.level})` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {formData.classId ? (
              <FeeStructureItemsForm
                classLabel={selectedClassLabel}
                termLabel={currentTerm}
                yearLabel={currentYear}
                onItemsChange={handleItemsChange}
                fieldErrors={itemErrors}
              />
            ) : (
              <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-6 text-center">
                Select a class to configure tuition and optional fees for this term.
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => handleInputChange('dueDate', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Optional notes for this term's bill"
                />
              </div>
            </div>

            <div className="form-action-bar flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({ classId: '', dueDate: '', description: '' });
                  setItemErrors({});
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primaryAction" disabled={isSubmitting || !formData.classId}>
                {isSubmitting ? 'Saving…' : 'Save Structure'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      <Card className="border-border bg-card text-card-foreground shadow-sm">
        <CardHeader className="border-b border-border/70 bg-muted/30">
          <CardTitle>Fee Structures - {currentTerm}</CardTitle>
          <p className="text-sm text-muted-foreground">Only structures for the active term are shown</p>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {currentTermFees.map((fee) => (
              <div key={fee.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-foreground">{resolveFeeClassLabel(fee)}</p>
                  <p className="text-sm text-muted-foreground">{fee.term || `${currentTerm} (legacy)`}</p>
                  {fee.description ? (
                    <p className="text-xs text-muted-foreground italic">Note: {fee.description}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                  <div className="text-left sm:text-right min-w-[140px]">
                    <TermBillBreakdown total={fee.amount} feeStructureId={fee.id} compact />
                    {fee.dueDate && <p className="text-sm text-muted-foreground mt-1">Due: {fee.dueDate}</p>}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => handleEdit(fee)} disabled={isSubmitting} className="min-h-9 min-w-9">
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="min-h-9 min-w-9 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/40" onClick={() => handleDelete(fee)} disabled={isSubmitting}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {currentTermFees.length === 0 && (
              <div className="text-center py-8 space-y-2">
                <p className="text-muted-foreground">No fee structure assigned for {currentTerm}.</p>
                <p className="text-xs text-muted-foreground">
                  Create a new structure above, or reuse one from a closed term in the archive panel.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editingId} onOpenChange={() => { setEditingId(null); setEditingFee(null); }}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
            <DialogTitle>Edit Fee Structure</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 px-6 py-4 overflow-y-auto">
            {editingId && editingFee ? (
              <FeeStructureItemsForm
                feeStructureId={editingId}
                classLabel={editingFee.className}
                termLabel={editingFee.term}
                yearLabel={currentYear}
                onItemsChange={handleEditItemsChange}
                fieldErrors={editItemErrors}
              />
            ) : null}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="form-action-bar shrink-0 gap-2 px-6 py-4">
            <Button variant="outline" onClick={() => { setEditingId(null); setEditingFee(null); }} disabled={isSubmitting}>Cancel</Button>
            <Button variant="primaryAction" onClick={handleEditSave} disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Structure'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BillStudentModal
        open={billModalOpen}
        onOpenChange={setBillModalOpen}
        onSuccess={() => void refresh(['fees'])}
      />
    </div>
  );
};

export default SetFeeStructure;
