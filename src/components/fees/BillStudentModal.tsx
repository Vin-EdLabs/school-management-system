import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useData, type Student } from '../../contexts/DataContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { createStudentCharge, deleteStudentCharge, fetchStudentCharges, type StudentCharge } from '../../services/studentCharges';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import LazyStudentAvatar from '../students/LazyStudentAvatar';
import { toast } from '@/hooks/use-toast';
import { Info, Loader2, Search, Trash2, X } from 'lucide-react';

type BillStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const BillStudentModal: React.FC<BillStudentModalProps> = ({ open, onOpenChange, onSuccess }) => {
  const { students, refresh } = useData();
  const { currentTerm, currentYear, activeAcademicTermId } = useActiveTerm();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingChargeId, setRemovingChargeId] = useState<number | null>(null);
  const [manualCharges, setManualCharges] = useState<StudentCharge[]>([]);
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [selectedChargeToRemove, setSelectedChargeToRemove] = useState<StudentCharge | null>(null);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeStudents = useMemo(
    () => students.filter((s) => shouldTrackStudentFees(s)),
    [students]
  );

  const filteredStudents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return [];
    return activeStudents
      .filter(
        (s) =>
          s.firstName.toLowerCase().includes(q) ||
          s.lastName.toLowerCase().includes(q) ||
          s.studentId.includes(q) ||
          `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [activeStudents, searchTerm]);

  const resetFormFields = () => {
    setDescription('');
    setAmount('');
    setReason('');
    setError(null);
    setSelectedChargeToRemove(null);
  };

  const resetModal = () => {
    setSearchTerm('');
    setSelectedStudent(null);
    setManualCharges([]);
    resetFormFields();
  };

  const loadManualCharges = async (studentId: string) => {
    if (!activeAcademicTermId) {
      setManualCharges([]);
      return;
    }
    setLoadingCharges(true);
    try {
      const charges = await fetchStudentCharges(studentId, activeAcademicTermId);
      setManualCharges(charges);
    } catch {
      setManualCharges([]);
    } finally {
      setLoadingCharges(false);
    }
  };

  useEffect(() => {
    if (!selectedStudent) {
      setManualCharges([]);
      return;
    }
    void loadManualCharges(selectedStudent.id);
  }, [selectedStudent, activeAcademicTermId]);

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const canSubmit =
    !!selectedStudent &&
    description.trim().length > 0 &&
    Number(amount) > 0 &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !selectedStudent) return;

    setSubmitting(true);
    setError(null);
    try {
      await createStudentCharge({
        student_id: parseInt(selectedStudent.id, 10),
        description: description.trim(),
        amount: Number(amount),
        reason: reason.trim() || undefined,
      });

      const studentName = `${selectedStudent.firstName} ${selectedStudent.lastName}`.trim();
      toast({
        title: 'Charge added',
        description: `GHS ${Number(amount).toFixed(2)} charge added to ${studentName}'s ${currentTerm} bill successfully.`,
      });

      await loadManualCharges(selectedStudent.id);
      await refresh(['fees']);
      onSuccess?.();
      resetFormFields();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add charge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCharge = (charge: StudentCharge) => {
    setSelectedChargeToRemove(charge);
    setConfirmRemoveOpen(true);
  };

  const confirmRemoveCharge = async () => {
    if (!selectedChargeToRemove || !selectedStudent) return;
    setRemovingChargeId(selectedChargeToRemove.id);
    try {
      await deleteStudentCharge(selectedChargeToRemove.id);
      await loadManualCharges(selectedStudent.id);
      await refresh(['fees']);
      toast({
        title: 'Charge removed',
        description: `The manual charge was removed from the student bill.`,
      });
      setConfirmRemoveOpen(false);
      setSelectedChargeToRemove(null);
    } catch (err: unknown) {
      toast({
        title: 'Unable to remove charge',
        description: err instanceof Error ? err.message : 'Failed to remove charge.',
        variant: 'destructive',
      });
    } finally {
      setRemovingChargeId(null);
    }
  };

  const termDisplay =
    currentTerm && currentYear && !currentTerm.includes(currentYear)
      ? `${currentTerm} ${currentYear}`
      : currentTerm || 'No active term';

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[760px] rounded-[1rem] border-t-4 border-emerald-500 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle>Bill a Student</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Active term: <span className="font-medium text-foreground">{termDisplay}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4 overflow-y-auto px-6 py-4">
            <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm text-emerald-900 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold">How this works</p>
                  <p className="mt-1 leading-6 text-slate-700">
                    Bill this student directly to their active term. The charge appears on their term bill and receipt immediately. Use this for one-off charges like damages, lost items, or extra services not covered by the standard fee structure.
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="billStudentSearch">Search Student *</Label>
              {selectedStudent ? (
                <div className="overflow-hidden rounded-3xl border border-border bg-slate-50 p-4 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <LazyStudentAvatar
                      studentId={selectedStudent.id}
                      photoUrl={selectedStudent.passportPhotoUrl}
                      hasPassportPhoto={selectedStudent.hasPassportPhoto}
                      firstName={selectedStudent.firstName}
                      lastName={selectedStudent.lastName}
                      className="h-16 w-16 rounded-3xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-foreground truncate">
                        {selectedStudent.firstName} {selectedStudent.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        Class: {selectedStudent.classAssigned}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        Admission #: {selectedStudent.studentId}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-full border border-border bg-white p-2 text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        setSelectedStudent(null);
                        setSearchTerm('');
                      }}
                      aria-label="Clear student"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Bill this student directly to their selected active term. The charge appears on the student&apos;s term bill and receipt.
                  </p>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="billStudentSearch"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name or student ID…"
                      className="pl-9"
                      disabled={submitting}
                    />
                  </div>
                  {searchTerm.trim() && (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-card shadow-sm">
                      {filteredStudents.length === 0 ? (
                        <p className="p-3 text-sm text-muted-foreground">No active students found.</p>
                      ) : (
                        filteredStudents.map((student) => (
                          <button
                            key={student.id}
                            type="button"
                            className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
                            onClick={() => {
                              setSelectedStudent(student);
                              setSearchTerm('');
                            }}
                          >
                            <LazyStudentAvatar
                              studentId={student.id}
                              photoUrl={student.passportPhotoUrl}
                              hasPassportPhoto={student.hasPassportPhoto}
                              firstName={student.firstName}
                              lastName={student.lastName}
                              className="h-9 w-9 shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {student.firstName} {student.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {student.studentId} · {student.classAssigned}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedStudent ? (
              <div className="rounded-3xl border border-border bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Manual Charges This Term</p>
                    <p className="text-xs text-muted-foreground">{termDisplay}</p>
                  </div>
                  {loadingCharges ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
                </div>
                <div className="mt-4 space-y-3">
                  {manualCharges.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                      No manual charges have been added for this student in the current term.
                    </div>
                  ) : (
                    manualCharges.map((charge) => (
                      <div key={charge.id} className="rounded-3xl border border-border p-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{charge.description}</p>
                            <p className="text-sm text-muted-foreground">{charge.createdByName ?? 'System'} • {new Date(charge.createdAt).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-semibold text-emerald-700">GHS {charge.amount.toFixed(2)}</span>
                            {charge.status === 'unpaid' ? (
                              <button
                                type="button"
                                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-100"
                                onClick={() => handleRemoveCharge(charge)}
                              >
                                <Trash2 className="h-4 w-4" />
                                Remove
                              </button>
                            ) : (
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">Paid</span>
                            )}
                          </div>
                        </div>
                        {charge.reason ? (
                          <p className="mt-2 text-sm text-slate-600">{charge.reason}</p>
                        ) : null}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="chargeDescription">Charge Description *</Label>
              <Input
                id="chargeDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Broke laboratory glass, Lost Biology textbook, Extra uniform"
                maxLength={500}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeAmount">Amount (GHS) *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">GHS</span>
                <Input
                  id="chargeAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-12"
                  placeholder="0.00"
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="chargeReason">Reason / Additional Note</Label>
              <Textarea
                id="chargeReason"
                value={reason}
                onChange={(e) => setReason(e.target.value.slice(0, 300))}
                placeholder="Any extra context for this charge…"
                rows={3}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground text-right">{reason.length}/300</p>
            </div>
          </DialogBody>

          <DialogFooter className="form-action-bar shrink-0 gap-2 border-t border-border/70 px-6 py-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting || removingChargeId != null}>
              Cancel
            </Button>
            <Button type="submit" variant="primaryAction" disabled={!canSubmit || removingChargeId != null}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Billing…
                </>
              ) : (
                'Bill Student'
              )}
            </Button>
          </DialogFooter>
        </form>

        <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this charge?</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedChargeToRemove ? (
                  <>
                    “{selectedChargeToRemove.description}” — GHS {selectedChargeToRemove.amount.toFixed(2)}
                    <br />
                    This will permanently remove this charge from the student&apos;s bill. This cannot be undone.
                  </>
                ) : (
                  'This will permanently remove the selected charge from the student bill.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                className="inline-flex items-center justify-center rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
                onClick={() => void confirmRemoveCharge()}
                disabled={removingChargeId != null}
              >
                {removingChargeId ? 'Removing…' : 'Remove Charge'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default BillStudentModal;
