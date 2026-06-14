import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import type { Teacher } from '@/contexts/DataContext';

const SUSPEND_REASONS = [
  'Under Investigation',
  'Disciplinary Action',
  'Medical Leave',
  'Other',
];

const DEACTIVATE_REASONS = ['Resigned', 'Terminated', 'Contract Ended', 'Retired', 'Other'];

type Mode = 'suspend' | 'deactivate' | 'reactivate' | null;

export function TeacherStatusModals({
  teacher,
  mode,
  onClose,
  onSuccess,
}: {
  teacher: Teacher | null;
  mode: Mode;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [reactivationReason, setReactivationReason] = useState('');

  if (!teacher || !mode) return null;

  const submit = async () => {
    if (!teacher) return;
    setLoading(true);
    try {
      if (mode === 'suspend') {
        if (!reason) {
          toast({ title: 'Select a reason', variant: 'destructive' });
          return;
        }
        await apiService.post(`/teachers/${teacher.id}/suspend`, {
          reason,
          suspension_start_date: startDate,
          suspension_end_date: endDate || null,
          notes,
        });
        toast({ title: 'Teacher suspended', description: `${teacher.fullName} login disabled.` });
      } else if (mode === 'deactivate') {
        if (!reason) {
          toast({ title: 'Select a reason', variant: 'destructive' });
          return;
        }
        const res = await apiService.post<{ notification?: string }>(`/teachers/${teacher.id}/deactivate`, {
          reason,
          effective_date: effectiveDate,
          notes,
        });
        toast({
          title: 'Teacher deactivated',
          description: res.notification || `${teacher.fullName} has been deactivated.`,
        });
      } else {
        if (!reactivationReason.trim()) {
          toast({ title: 'Reactivation reason required', variant: 'destructive' });
          return;
        }
        await apiService.post(`/teachers/${teacher.id}/reactivate`, { reason: reactivationReason.trim() });
        toast({
          title: 'Teacher reactivated',
          description: 'Login restored. Reassign class manually if needed.',
        });
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast({
        title: 'Action failed',
        description: e instanceof Error ? e.message : 'Try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === 'suspend' ? 'Suspend Teacher' : mode === 'deactivate' ? 'Deactivate Teacher' : 'Reactivate Teacher';

  return (
    <Dialog open={!!mode} onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {teacher.fullName} ({teacher.staffId})
          </p>
          {mode === 'suspend' && (
            <>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {SUSPEND_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Suspension start</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Expected return (optional)</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </>
          )}
          {mode === 'deactivate' && (
            <>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {DEACTIVATE_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Effective date</Label>
                <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
            </>
          )}
          {mode === 'reactivate' && (
            <div className="space-y-2">
              <Label>Reason for reactivation</Label>
              <Textarea
                value={reactivationReason}
                onChange={(e) => setReactivationReason(e.target.value)}
                placeholder="Required — e.g. Returned from medical leave"
                rows={3}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={mode === 'deactivate' ? 'destructive' : 'default'} onClick={submit} disabled={loading}>
            {loading ? 'Saving…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function teacherStatusBadge(status: string) {
  const s = (status || 'active').toLowerCase();
  if (s === 'suspended') return { label: 'SUSPENDED', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' };
  if (s === 'deactivated') return { label: 'DEACTIVATED', className: 'bg-red-100 text-red-800 border-red-300' };
  return null;
}
