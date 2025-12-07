import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useChangePassword } from '@/hooks/useAuth';
import { AlertCircle } from 'lucide-react';
import React, { useState } from 'react';

interface ChangePasswordDialogProps {
  open: boolean;
  isRequired?: boolean;
  onSuccess?: () => void;
}

const ChangePasswordDialog: React.FC<ChangePasswordDialogProps> = ({ open, isRequired = false, onSuccess }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { mutateAsync: changePassword, isPending } = useChangePassword();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!oldPassword || !newPassword || !confirmPassword) {
      toast({
        title: 'Validation Error',
        description: 'All fields are required',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Validation Error',
        description: 'New passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: 'Validation Error',
        description: 'New password must be at least 6 characters',
        variant: 'destructive'
      });
      return;
    }

    try {
      await changePassword({ oldPassword, newPassword });

      toast({
        title: 'Success',
        description: 'Password changed successfully'
      });

      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.message ?? 'Failed to change password',
        variant: 'destructive'
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => !isRequired}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change Your Password</DialogTitle>
          <DialogDescription>
            {isRequired ? (
              <div className="flex items-start gap-2 mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-yellow-800">
                  You must change your password on first login for security reasons.
                </span>
              </div>
            ) : (
              'Update your password to something more secure.'
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Current Password</Label>
            <Input
              id="oldPassword"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New Password</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              disabled={isPending}
            />
          </div>

          <DialogFooter>
            <div className="flex gap-2 w-full">
              {!isRequired && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOldPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  disabled={isPending}
                  className="flex-1"
                >
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isPending} className="flex-1">
                {isPending ? 'Changing...' : 'Change Password'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ChangePasswordDialog;
