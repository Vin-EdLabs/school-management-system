import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

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
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle>Fee Structure Not Configured</DialogTitle>
          <DialogDescription>
            Fee structures have not been set for the following classes this term. Please configure
            them before recording any payments.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[200px] overflow-y-auto rounded-md border border-amber-200 bg-amber-50/50 px-4 py-3 text-sm">
          {missingClasses.map((cls) => (
            <li key={cls.id} className="py-1 text-slate-800">
              {cls.name}
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button type="button" variant="primaryAction" className="w-full" onClick={onGoToSetup}>
            Set Up Fee Structures
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
