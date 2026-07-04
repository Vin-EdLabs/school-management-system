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
import { AlertTriangle, RotateCcw } from 'lucide-react';

export type StaffConfirmAction = 'soft' | 'hard' | 'restore' | 'permanent';

type StaffActionConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: StaffConfirmAction | null;
  staffName: string;
  staffId?: string;
  schoolName?: string;
  staffType?: 'teacher' | 'other';
  loading?: boolean;
  onConfirm: () => void;
  onBack?: () => void;
};

const copyForAction = (
  action: StaffConfirmAction,
  staffType: 'teacher' | 'other',
  schoolName?: string
) => {
  const who = staffType === 'teacher' ? 'teacher' : 'staff member';
  const school = schoolName ? ` at ${schoolName}` : '';

  switch (action) {
    case 'soft':
      return {
        title: 'Confirm soft delete',
        description: `This will remove the ${who} from school lists${school}. Salary and payment records stay intact.`,
        confirmLabel: 'Yes, soft delete',
        tone: 'amber' as const,
      };
    case 'hard':
      return {
        title: 'Confirm permanent delete',
        description: `This permanently hides the ${who} from all admin views${school}, including super-admin. Payment records are never deleted.`,
        confirmLabel: 'Yes, permanently delete',
        tone: 'destructive' as const,
      };
    case 'restore':
      return {
        title: 'Restore to school?',
        description: `This returns the ${who} to the school's active lists${school}. Personal details scrubbed during removal may need to be re-entered by the school admin.`,
        confirmLabel: 'Yes, restore to school',
        tone: 'emerald' as const,
      };
    case 'permanent':
      return {
        title: 'Confirm permanent delete',
        description: `This permanently hides this removed ${who} record${school}. They will no longer appear in Removed Staff. Payment history is preserved.`,
        confirmLabel: 'Yes, permanently delete',
        tone: 'destructive' as const,
      };
  }
};

const StaffActionConfirmDialog: React.FC<StaffActionConfirmDialogProps> = ({
  open,
  onOpenChange,
  action,
  staffName,
  staffId,
  schoolName,
  staffType = 'teacher',
  loading,
  onConfirm,
  onBack,
}) => {
  if (!action) return null;
  const copy = copyForAction(action, staffType, schoolName);
  const Icon = action === 'restore' ? RotateCcw : AlertTriangle;

  const iconWrap =
    copy.tone === 'destructive'
      ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
      : copy.tone === 'emerald'
        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} sm:max-w-lg`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconWrap}`}>
              <Icon className="h-4 w-4" />
            </span>
            {copy.title}
          </DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          {schoolName ? <DetailField label="School">{schoolName}</DetailField> : null}
          <DetailField label="Name">{staffName}</DetailField>
          {staffId ? (
            <DetailField label="Staff ID">
              <span className="font-mono">{staffId}</span>
            </DetailField>
          ) : null}
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-col sm:flex-row gap-2`}>
          {onBack ? (
            <Button variant="ghost" className="rounded-xl w-full sm:w-auto" onClick={onBack} disabled={loading}>
              Back
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="rounded-xl w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={copy.tone === 'destructive' ? 'destructive' : copy.tone === 'emerald' ? 'default' : 'outline'}
            className={
              copy.tone === 'amber'
                ? 'rounded-xl w-full sm:w-auto border-amber-500/40 text-amber-800 dark:text-amber-200'
                : 'rounded-xl w-full sm:w-auto'
            }
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Please wait…' : copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffActionConfirmDialog;
