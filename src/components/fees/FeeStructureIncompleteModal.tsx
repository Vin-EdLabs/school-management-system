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
import { AlertTriangle, Settings2 } from 'lucide-react';

export type FeeStructureIncompleteModalProps = {
  open: boolean;
  missingClasses: { id: string; name: string }[];
  onClose: () => void;
  onGoToSetup: () => void;
};

const FeeStructureIncompleteModal: React.FC<FeeStructureIncompleteModalProps> = ({
  open,
  missingClasses,
  onClose,
  onGoToSetup,
}) => {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent
        className={`${detailDialogContentClass} sm:max-w-md`}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className={detailDialogHeaderClass}>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-800">
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <DialogTitle>Fee structure not configured</DialogTitle>
              <DialogDescription className="mt-1.5">
                Fee structures have not been set for the following classes this term. Configure them
                before recording any payments.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-3`}>
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            <span className="font-semibold">{missingClasses.length}</span>{' '}
            {missingClasses.length === 1 ? 'class needs' : 'classes need'} a fee structure for the
            active term.
          </div>

          <ul className="max-h-[220px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/80 divide-y divide-slate-200 dark:border-slate-800 dark:bg-slate-900/40 dark:divide-slate-800">
            {missingClasses.map((cls) => (
              <li
                key={cls.id}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-100"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" aria-hidden />
                {cls.name}
              </li>
            ))}
          </ul>
        </DialogBody>

        <DialogFooter className={`${detailDialogFooterClass} flex-col gap-2 sm:flex-col`}>
          <Button type="button" variant="primaryAction" className="w-full" onClick={onGoToSetup}>
            <Settings2 className="mr-2 h-4 w-4" />
            Set up fee structures
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FeeStructureIncompleteModal;
