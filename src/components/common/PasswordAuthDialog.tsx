
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

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

    // Get stored passwords from localStorage
    const savedPasswords = localStorage.getItem('rosaGardensPasswords');
    const passwords = savedPasswords ? JSON.parse(savedPasswords) : {
      'super-admin': 'superadmin123',
      'finance': 'finance123', 
      'administrator': 'admin123'
    };

    if (user && password === passwords[user.role]) {
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

    setIsLoading(false);
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
            />
          </div>

          <DialogFooter className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose}>
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
