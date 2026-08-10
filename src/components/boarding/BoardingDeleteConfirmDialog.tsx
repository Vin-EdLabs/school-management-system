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

export interface BoardingDeleteConfirmState {
  title: string;
  description: string;
  subjectLabel: string;
  subjectValue: string;
  confirmLabel?: string;
  warning?: string;
}

interface BoardingDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: BoardingDeleteConfirmState | null;
  loading?: boolean;
  onConfirm: () => void;
}

export const BoardingDeleteConfirmDialog: React.FC<BoardingDeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  state,
  loading,
  onConfirm,
}) => {
  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} sm:max-w-lg border-t-4 border-red-500`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
            </span>
            {state.title}
          </DialogTitle>
          <DialogDescription>{state.description}</DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          <DetailField label={state.subjectLabel}>{state.subjectValue}</DetailField>
          {state.warning ? (
            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              {state.warning}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-col sm:flex-row gap-2`}>
          <Button
            type="button"
            variant="outline"
            className="rounded-xl w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl w-full sm:w-auto"
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? 'Please wait…' : state.confirmLabel || 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BoardingDeleteConfirmDialog;
