
import { useState } from 'react';
import { useAudit } from '../contexts/AuditContext';
import { useAuth } from '../contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface UseAuditLogProps {
  module: string;
  actionType: 'Edit' | 'Delete';
}

export const useAuditLog = ({ module, actionType }: UseAuditLogProps) => {
  const { addAuditLog } = useAudit();
  const { user } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [itemDetails, setItemDetails] = useState<{ id?: string; name?: string }>({});

  const promptForAudit = (action: () => void, itemId?: string, itemName?: string) => {
    setPendingAction(() => action);
    setItemDetails({ id: itemId, name: itemName });
    setIsDialogOpen(true);
  };

  const handleConfirm = () => {
    if (!user) return;

    // Verify password (simplified - using current role password)
    const passwords = {
      'super-admin': 'superadmin123',
      'finance': 'finance123', 
      'administrator': 'admin123'
    };

    if (password !== passwords[user.role]) {
      alert('Incorrect password');
      return;
    }

    // Execute the action
    if (pendingAction) {
      pendingAction();
      
      // Log the audit entry
      addAuditLog({
        actionType,
        module,
        itemId: itemDetails.id,
        itemName: itemDetails.name,
        reason: reason || undefined
      });
    }

    // Reset state
    setIsDialogOpen(false);
    setPassword('');
    setReason('');
    setPendingAction(null);
    setItemDetails({});
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setPassword('');
    setReason('');
    setPendingAction(null);
    setItemDetails({});
  };

  const AuditDialog = () => (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm {actionType} Action</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="password">Enter your password to confirm:</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          <div>
            <Label htmlFor="reason">Reason (optional):</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you performing this action?"
              rows={3}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={!password}>
              Confirm {actionType}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  return { promptForAudit, AuditDialog };
};
