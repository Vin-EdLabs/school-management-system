import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useData } from '../../contexts/DataContext';
import { apiService } from '../../services/api';
import { mapStudent } from '../../utils/studentMappers';
import { formatDisplayDate } from '../../utils/dateFormat';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Clock, Loader2, UserX, XCircle } from 'lucide-react';
import LazyStudentAvatar from './LazyStudentAvatar';
import type { Student } from '../../contexts/DataContext';

const PendingAdmissions = () => {
  const { classes, refresh } = useData();
  const [rows, setRows] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveTarget, setApproveTarget] = useState<Student | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Student | null>(null);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiService.get<Record<string, unknown>[]>('/students?status=pending');
      setRows((data || []).map(mapStudent));
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load pending admissions',
        variant: 'destructive',
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort(
        (a, b) => new Date(b.dateOfAdmission || 0).getTime() - new Date(a.dateOfAdmission || 0).getTime()
      ),
    [rows]
  );

  const handleApprove = async () => {
    if (!approveTarget || !selectedClassId) return;
    setSaving(true);
    try {
      await apiService.post(`/students/${approveTarget.id}/approve-admission`, {
        class_assigned_id: parseInt(selectedClassId, 10),
      });
      toast({
        title: 'Student enrolled',
        description: `${approveTarget.firstName} ${approveTarget.lastName} is now an active student.`,
      });
      setApproveTarget(null);
      setSelectedClassId('');
      await Promise.all([loadPending(), refresh(['students'])]);
    } catch (err: any) {
      toast({
        title: 'Approval failed',
        description: err?.response?.data?.error || err?.message || 'Could not approve admission',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    setSaving(true);
    try {
      await apiService.post(`/students/${rejectTarget.id}/reject-admission`, {
        reason: rejectReason.trim(),
      });
      toast({
        title: 'Admission rejected',
        description: `${rejectTarget.firstName} ${rejectTarget.lastName} was removed from pending admissions.`,
      });
      setRejectTarget(null);
      setRejectReason('');
      await Promise.all([loadPending(), refresh(['students'])]);
    } catch (err: any) {
      toast({
        title: 'Rejection failed',
        description: err?.response?.data?.error || err?.message || 'Could not reject admission',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5 text-amber-600" />
          Pending admissions
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Students awaiting approval are not counted in totals and cannot receive fees or payments until enrolled.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Admission #</TableHead>
                <TableHead>Applied</TableHead>
                <TableHead>Guardian</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                    Loading pending admissions…
                  </TableCell>
                </TableRow>
              ) : sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No pending admissions.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <LazyStudentAvatar
                          studentId={student.id}
                          firstName={student.firstName}
                          lastName={student.lastName}
                          hasPassportPhoto={student.hasPassportPhoto}
                          className="h-10 w-10"
                        />
                        <div>
                          <p className="font-medium">
                            {student.firstName} {student.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{student.studentId}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{student.admissionNumber}</TableCell>
                    <TableCell className="text-sm">{formatDisplayDate(student.dateOfAdmission)}</TableCell>
                    <TableCell className="text-sm">
                      <div>{student.guardianName || '—'}</div>
                      <div className="text-xs text-muted-foreground">{student.guardianContact || ''}</div>
                    </TableCell>
                    <TableCell>
                      <Badge className="border-amber-500/35 bg-amber-500/12 text-amber-800 dark:text-amber-200">
                        PENDING
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setApproveTarget(student);
                            setSelectedClassId('');
                          }}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve &amp; Enroll
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            setRejectTarget(student);
                            setRejectReason('');
                          }}
                        >
                          <UserX className="h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve &amp; enroll student</DialogTitle>
          </DialogHeader>
          {approveTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm enrollment for{' '}
                <span className="font-medium text-foreground">
                  {approveTarget.firstName} {approveTarget.lastName}
                </span>
                . Select the class to assign before confirming.
              </p>
              <div className="space-y-2">
                <Label>Class to assign *</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select class…" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={!selectedClassId || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm enrollment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject pending admission</DialogTitle>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Reject{' '}
                <span className="font-medium text-foreground">
                  {rejectTarget.firstName} {rejectTarget.lastName}
                </span>
                ? This removes them from the pending list and is logged in the audit trail.
              </p>
              <div className="space-y-2">
                <Label htmlFor="reject-reason">Reason *</Label>
                <Textarea
                  id="reject-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Explain why this admission was rejected…"
                  rows={3}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason.trim() || saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
              Reject admission
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PendingAdmissions;
