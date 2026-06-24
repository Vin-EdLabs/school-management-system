import React from 'react';
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

type StaffDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  staffId?: string;
  staffType?: 'teacher' | 'other';
  loading?: boolean;
  onConfirm: () => void;
};

const StaffDeleteConfirmDialog: React.FC<StaffDeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  staffName,
  staffId,
  staffType = 'teacher',
  loading,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
      <DialogHeader className={detailDialogHeaderClass}>
        <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4" />
          </span>
          Remove {staffType === 'teacher' ? 'teacher' : 'staff member'}?
        </DialogTitle>
        <DialogDescription>
          This removes them from active lists only. Salary and payment history stay intact.
        </DialogDescription>
      </DialogHeader>

      <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
        <DetailField label="Name">{staffName}</DetailField>
        {staffId ? (
          <DetailField label="Staff ID">
            <span className="font-mono">{staffId}</span>
          </DetailField>
        ) : null}
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-100">
          All salary payments and payroll records for this person will remain available in finance reports.
        </div>
      </DialogBody>

      <DialogFooter className={detailDialogFooterClass}>
        <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button variant="destructive" className="rounded-xl" onClick={onConfirm} disabled={loading}>
          {loading ? 'Removing…' : 'Remove from active list'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default StaffDeleteConfirmDialog;
