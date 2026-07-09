import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
  detailDialogFooterClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, PowerOff } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termLabel: string;
  confirming: boolean;
  onConfirm: () => void;
};

export function MarkInactiveTermDialog({
  open,
  onOpenChange,
  termLabel,
  confirming,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={(next) => !confirming && onOpenChange(next)}>
      <DialogContent className={detailDialogContentClass}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 pr-0">
            <PowerOff className="h-5 w-5 shrink-0 text-amber-600" />
            Mark term inactive?
          </DialogTitle>
          <DialogDescription>
            This removes the active flag from <strong>{termLabel}</strong>. It does not permanently close the term.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-3 text-sm`}>
          <p>
            Use this when the wrong term is active and you need to <strong>close</strong> or{' '}
            <strong>set active</strong> another term.
          </p>
          <p className="text-muted-foreground">
            Historical records are not deleted. To lock a term forever, use <strong>Close Term</strong> instead.
          </p>
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button variant="primaryAction" onClick={onConfirm} disabled={confirming}>
            {confirming ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Updating…
              </>
            ) : (
              'Mark inactive'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default MarkInactiveTermDialog;
