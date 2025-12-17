
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/api';

interface PasswordAuthDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (reason?: string) => void;
  action: 'edit' | 'delete';
  itemName: string;
  module: string;
}

const PasswordAuthDialog: React.FC<PasswordAuthDialogProps> = ({
  open,
  onClose,
  onSuccess,
  action,
  itemName,
  module
}) => {
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({
        title: "Password Required",
        description: "Please enter your password to continue",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call the backend API to verify the password
      const response = await apiService.post('/api/auth/verify-password', {
        password: password.trim()
      });

      const verified = (response as any)?.verified ?? (response as any)?.data?.verified;

      if (verified) {
        onSuccess(reason.trim() || undefined);
        setPassword('');
        setReason('');
        onClose();
      } else {
        toast({
          title: "Authentication Failed",
          description: "Incorrect password. Please try again.",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ||
        error?.message ||
        'Authentication failed. Please try again.';
      toast({
        title: "Authentication Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Authenticate {action === 'edit' ? 'Edit' : 'Delete'} Action
          </DialogTitle>
          <DialogDescription>Authenticate this action by entering your password.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              You are about to {action} <strong>{itemName}</strong> in the <strong>{module}</strong> module.
              Please enter your password to continue.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason (Optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for this action..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={action === 'delete' ? 'destructive' : 'default'}
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating...' : `Confirm ${action === 'edit' ? 'Edit' : 'Delete'}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PasswordAuthDialog;
