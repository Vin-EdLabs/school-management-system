import React, { useMemo, useState } from 'react';
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
import { useData, type Student } from '../../contexts/DataContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { createStudentCharge } from '../../services/studentCharges';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import LazyStudentAvatar from '../students/LazyStudentAvatar';
import { toast } from '@/hooks/use-toast';
import { Loader2, Search, X } from 'lucide-react';

type BillStudentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const BillStudentModal: React.FC<BillStudentModalProps> = ({ open, onOpenChange, onSuccess }) => {
  const { students, refresh } = useData();
  const { currentTerm, currentYear } = useActiveTerm();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
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

  const resetForm = () => {
    setSearchTerm('');
    setSelectedStudent(null);
    setDescription('');
    setAmount('');
    setReason('');
    setError(null);
  };

  const handleClose = () => {
    resetForm();
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

      await refresh(['fees']);
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add charge');
    } finally {
      setSubmitting(false);
    }
  };

  const termDisplay =
    currentTerm && currentYear && !currentTerm.includes(currentYear)
      ? `${currentTerm} ${currentYear}`
      : currentTerm || 'No active term';

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : handleClose())}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-6 py-4">
          <DialogTitle>Bill a Student</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Active term: <span className="font-medium text-foreground">{termDisplay}</span>
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogBody className="space-y-4 overflow-y-auto px-6 py-4">
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primaryAction" disabled={!canSubmit}>
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
      </DialogContent>
    </Dialog>
  );
};

export default BillStudentModal;
