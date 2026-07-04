import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
  DetailField,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import StaffActionConfirmDialog, { type StaffConfirmAction } from './StaffActionConfirmDialog';

export type StaffRemovalMode = 'soft' | 'hard';

type StaffRemovalConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  staffId?: string;
  staffType?: 'teacher' | 'other';
  loading?: boolean;
  onConfirm: (mode: StaffRemovalMode) => void;
};

const StaffRemovalConfirmDialog: React.FC<StaffRemovalConfirmDialogProps> = ({
  open,
  onOpenChange,
  staffName,
  staffId,
  staffType = 'teacher',
  loading,
  onConfirm,
}) => {
  const [pendingMode, setPendingMode] = useState<StaffRemovalMode | null>(null);
  const label = staffType === 'teacher' ? 'teacher' : 'staff member';

  useEffect(() => {
    if (!open) setPendingMode(null);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setPendingMode(null);
    onOpenChange(next);
  };

  const confirmAction: StaffConfirmAction | null =
    pendingMode === 'soft' ? 'soft' : pendingMode === 'hard' ? 'hard' : null;

  return (
    <>
      <Dialog open={open && !pendingMode} onOpenChange={handleOpenChange}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4" />
              </span>
              Delete {label}?
            </DialogTitle>
            <DialogDescription>
              This is separate from deactivating employment status. Choose how to delete this record from
              school lists. Salary and payment records are never removed.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <DetailField label="Name">{staffName}</DetailField>
            {staffId ? (
              <DetailField label="Staff ID">
                <span className="font-mono">{staffId}</span>
              </DetailField>
            ) : null}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100 space-y-2">
              <p>
                <strong>Soft delete</strong> — removes them from this school&apos;s lists.
                {staffType === 'teacher'
                  ? ' Platform super-admin can restore or permanently delete later.'
                  : ' Record is hidden but preserved for payroll history.'}
              </p>
              <p>
                <strong>Permanent delete</strong> — removes them from all admin views
                {staffType === 'teacher' ? ', including super-admin' : ''}. Payment history keeps
                their real name for finance records.
              </p>
            </div>
          </DialogBody>

          <DialogFooter className={`${detailDialogFooterClass} flex-col sm:flex-row gap-2`}>
            <Button
              variant="outline"
              className="rounded-xl w-full sm:w-auto"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="rounded-xl w-full sm:w-auto border-amber-500/40 text-amber-800 dark:text-amber-200"
              disabled={loading}
              onClick={() => setPendingMode('soft')}
            >
              Soft delete
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl w-full sm:w-auto"
              disabled={loading}
              onClick={() => setPendingMode('hard')}
            >
              Permanent delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaffActionConfirmDialog
        open={open && !!pendingMode}
        onOpenChange={(next) => {
          if (!next) {
            setPendingMode(null);
            if (!loading) onOpenChange(false);
          }
        }}
        action={confirmAction}
        staffName={staffName}
        staffId={staffId}
        staffType={staffType}
        loading={loading}
        onBack={() => setPendingMode(null)}
        onConfirm={() => {
          if (pendingMode) onConfirm(pendingMode);
        }}
      />
    </>
  );
};

export default StaffRemovalConfirmDialog;
