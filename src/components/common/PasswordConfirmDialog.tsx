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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

type PasswordConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirmed: () => void | Promise<void>;
};

const PasswordConfirmDialog: React.FC<PasswordConfirmDialogProps> = ({
  open,
  onOpenChange,
  title = 'Confirm with your password',
  description = 'Enter your account password to save these changes.',
  confirmLabel = 'Confirm & save',
  onConfirmed,
}) => {
  const { verifyPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirming(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!password.trim()) {
      toast({ title: 'Password required', description: 'Enter your password to continue', variant: 'destructive' });
      return;
    }
    if (confirming) return;
    setConfirming(true);
    try {
      const valid = await verifyPassword(password);
      if (!valid) {
        toast({ title: 'Incorrect password', description: 'Please try again', variant: 'destructive' });
        return;
      }
      setPassword('');
      onOpenChange(false);
      await onConfirmed();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${detailDialogContentClass} sm:max-w-md`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <KeyRound className="h-4 w-4" />
            </span>
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody className={detailDialogBodyClass}>
          <div className="space-y-2">
            <Label htmlFor="password-confirm-input">Your password</Label>
            <Input
              id="password-confirm-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              autoFocus
              disabled={confirming}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleConfirm();
                }
              }}
            />
          </div>
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={confirming}>
            Cancel
          </Button>
          <Button type="button" variant="primaryAction" className="rounded-xl" onClick={() => void handleConfirm()} disabled={confirming}>
            {confirming ? 'Checking…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordConfirmDialog;
