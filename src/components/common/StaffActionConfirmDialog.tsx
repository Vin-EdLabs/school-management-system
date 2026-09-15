import React, { useEffect, useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Eye, EyeOff, Lock, RotateCcw } from 'lucide-react';

export type StaffConfirmAction = 'soft' | 'hard' | 'restore' | 'permanent';

type StaffActionConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: StaffConfirmAction | null;
  staffName: string;
  staffId?: string;
  schoolName?: string;
  staffType?: 'teacher' | 'other' | 'student';
  loading?: boolean;
  /** When true, the acting admin must re-enter their own account password before Confirm is enabled. */
  requirePassword?: boolean;
  /** Server-side error to surface under the password field (e.g. "Incorrect password"), cleared by the caller on the next attempt. */
  passwordError?: string | null;
  onConfirm: (password?: string) => void;
  onBack?: () => void;
};

const copyForAction = (
  action: StaffConfirmAction,
  staffType: 'teacher' | 'other' | 'student',
  schoolName?: string
) => {
  const who = staffType === 'teacher' ? 'teacher' : staffType === 'student' ? 'student' : 'staff member';
  const school = schoolName ? ` at ${schoolName}` : '';
  const isStudent = staffType === 'student';

  switch (action) {
    case 'soft':
      return {
        title: 'Confirm soft delete',
        description: isStudent
          ? `This will remove the student from school lists${school} and disable their parent-portal access. The ScholarNerve team can restore or permanently delete this record.`
          : `This will remove the ${who} from school lists${school}. Salary and payment records stay intact.`,
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
        description: isStudent
          ? `This returns the student to the school's active lists${school} and re-enables their parent-portal account.`
          : `This returns the ${who} to the school's active lists${school}. Personal details scrubbed during removal may need to be re-entered by the school admin.`,
        confirmLabel: 'Yes, restore to school',
        tone: 'emerald' as const,
      };
    case 'permanent':
      return {
        title: 'Confirm permanent delete',
        description: isStudent
          ? `This permanently erases this student record${school} — including their fee ledger, payments, and receipts. This cannot be undone.`
          : `This permanently hides this removed ${who} record${school}. They will no longer appear in Removed Staff. Payment history is preserved.`,
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
  requirePassword,
  passwordError,
  onConfirm,
  onBack,
}) => {
  const passwordFieldId = useId();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!open) {
      setPassword('');
      setShowPassword(false);
    }
  }, [open]);

  if (!action) return null;
  const copy = copyForAction(action, staffType, schoolName);
  const Icon = action === 'restore' ? RotateCcw : AlertTriangle;
  const needsPassword = !!requirePassword;
  const confirmDisabled = !!loading || (needsPassword && !password.trim());

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
            <DetailField label={staffType === 'student' ? 'Student ID' : 'Staff ID'}>
              <span className="font-mono">{staffId}</span>
            </DetailField>
          ) : null}
          {needsPassword ? (
            <div className="space-y-1.5">
              <Label htmlFor={passwordFieldId} className="flex items-center gap-1.5 text-sm font-medium">
                <Lock className="h-3.5 w-3.5" />
                Confirm your password
              </Label>
              {/* Decoy fields: absorb browser/password-manager autofill so it doesn't land on the real input below. */}
              <input type="text" name="username" autoComplete="username" className="sr-only" tabIndex={-1} aria-hidden="true" />
              <input type="password" name="fake-password" autoComplete="new-password" className="sr-only" tabIndex={-1} aria-hidden="true" />
              <div className="relative">
                <Input
                  id={passwordFieldId}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !confirmDisabled) onConfirm(password);
                  }}
                  placeholder="Enter your account password"
                  autoComplete="new-password"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  data-lpignore="true"
                  data-1p-ignore=""
                  data-bwignore="true"
                  className="rounded-xl pr-10"
                  autoFocus
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                For your security, re-enter your own password to confirm this removal.
              </p>
              {passwordError ? <p className="text-xs font-medium text-destructive">{passwordError}</p> : null}
            </div>
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
            disabled={confirmDisabled}
            onClick={() => onConfirm(password)}
          >
            {loading ? 'Please wait…' : copy.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StaffActionConfirmDialog;
