import React from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: () => void;
  currentTermLabel: string;
  targetTermLabel: string;
  onCloseCurrentTerm: () => void;
  canCloseTerm: boolean;
};

export function CloseTermBeforeSwitchModal({
  open,
  onOpenChange,
  onCancel,
  currentTermLabel,
  targetTermLabel,
  onCloseCurrentTerm,
  canCloseTerm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            Close current term first
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                You cannot switch to <strong className="text-foreground">{targetTermLabel}</strong> while{' '}
                <strong className="text-foreground">{currentTermLabel}</strong> is still open.
              </p>
              <p>
                Close the current term first. Closing creates a permanent snapshot, carries forward balances,
                and activates the next term in sequence.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          {canCloseTerm ? (
            <Button variant="destructive" onClick={onCloseCurrentTerm}>
              <Lock className="h-4 w-4 mr-2" />
              Close Current Term
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground self-center mr-auto">
              Only a primary administrator can close terms.
            </p>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default CloseTermBeforeSwitchModal;
