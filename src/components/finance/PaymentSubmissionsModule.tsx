import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { apiService } from '../../services/api';
import { formatDisplayDateTime } from '@/utils/dateFormat';
import PaymentProofImageDialog from '@/components/payments/PaymentProofImageDialog';
import {
  paymentConfirmDialogClass,
  paymentRejectDialogClass,
} from '@/components/payments/paymentSubmissionUi';
import { resolvePaymentProofImageUrl } from '@/utils/paymentProofImage';
import { CheckCircle2, ClipboardCheck, Eye, Loader2, RefreshCw, XCircle } from 'lucide-react';

type SubmissionStatus = 'pending' | 'reviewed' | 'rejected';

interface PaymentSubmissionRow {
  id: number;
  studentId: number;
  studentName: string;
  studentIdLabel: string;
  className: string;
  parentName: string;
  amountClaimed: number;
  networkUsed: string;
  transactionReference?: string | null;
  screenshotUrl: string;
  status: SubmissionStatus;
  submittedAt: string;
  reviewedAt?: string | null;
  notes?: string | null;
}

const ALL = '__all__';

function statusBadge(status: SubmissionStatus) {
  if (status === 'reviewed') {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Reviewed</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive">Rejected</Badge>;
  }
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">Pending</Badge>;
}

const PaymentSubmissionsModule = () => {
  const [rows, setRows] = useState<PaymentSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [imageLoadingId, setImageLoadingId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<PaymentSubmissionRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PaymentSubmissionRow | null>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = statusFilter === ALL ? '' : `?status=${encodeURIComponent(statusFilter)}`;
      const data = await apiService.get<PaymentSubmissionRow[]>(`/payment-submissions${q}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Could not load submissions', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { pending: 0, reviewed: 0, rejected: 0 };
    for (const r of rows) {
      if (r.status in c) c[r.status as keyof typeof c] += 1;
    }
    return c;
  }, [rows]);

  const updateStatus = async (id: number, status: 'reviewed' | 'rejected', notes?: string) => {
    setActionLoading(id);
    try {
      await apiService.put(`/payment-submissions/${id}/status`, { status, notes });
      toast({
        title: status === 'reviewed' ? 'Payment confirmed' : 'Submission rejected',
        description: status === 'reviewed'
          ? 'Parent has been notified. Record the payment in Fees when ready.'
          : 'Parent has been notified with your reason.',
      });
      setConfirmTarget(null);
      setRejectTarget(null);
      setRejectNotes('');
      await load();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Update failed', description: err?.message, variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const openImagePreview = async (row: PaymentSubmissionRow) => {
    if (!row.screenshotUrl) return;
    setImageLoadingId(row.id);
    try {
      const url = await resolvePaymentProofImageUrl(`/payment-submissions/${row.id}/screenshot`);
      setImagePreview({
        url,
        title: 'Payment proof screenshot',
        subtitle: `${row.studentName} · GHS ${Number(row.amountClaimed).toLocaleString('en-GH', { minimumFractionDigits: 2 })} · ${row.networkUsed}`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Could not load screenshot', description: err?.message, variant: 'destructive' });
    } finally {
      setImageLoadingId(null);
    }
  };

  const closeImagePreview = (open: boolean) => {
    if (!open) {
      if (imagePreview?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview.url);
      }
      setImagePreview(null);
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ClipboardCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payment Submissions</h1>
            <p className="text-sm text-muted-foreground">Review parent payment proofs — record fees manually after approval.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-amber-700">{counts.pending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Reviewed</p>
            <p className="text-2xl font-bold text-emerald-700">{counts.reviewed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Rejected</p>
            <p className="text-2xl font-bold text-red-700">{counts.rejected}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label className="mb-1.5 block">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="reviewed">Reviewed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Student ID</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Screenshot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                      No payment submissions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {formatDisplayDateTime(row.submittedAt)}
                      </TableCell>
                      <TableCell className="font-medium">{row.studentName}</TableCell>
                      <TableCell>{row.studentIdLabel}</TableCell>
                      <TableCell>{row.className || '—'}</TableCell>
                      <TableCell>{row.parentName || '—'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        GHS {Number(row.amountClaimed).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{row.networkUsed}</TableCell>
                      <TableCell className="max-w-[120px] truncate text-xs">
                        {row.transactionReference || '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!row.screenshotUrl || imageLoadingId === row.id}
                          onClick={() => void openImagePreview(row)}
                          title="View screenshot"
                        >
                          {imageLoadingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        {row.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              disabled={actionLoading === row.id}
                              onClick={() => setConfirmTarget(row)}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Confirm
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50"
                              disabled={actionLoading === row.id}
                              onClick={() => {
                                setRejectTarget(row);
                                setRejectNotes('');
                              }}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PaymentProofImageDialog
        open={!!imagePreview}
        onOpenChange={closeImagePreview}
        imageUrl={imagePreview?.url ?? null}
        title={imagePreview?.title}
        subtitle={imagePreview?.subtitle}
      />

      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent className={paymentConfirmDialogClass}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Confirm payment submission?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Confirm you have reviewed the payment proof for{' '}
                  <strong>{confirmTarget?.studentName}</strong> (
                  GHS {Number(confirmTarget?.amountClaimed || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                  {' '}via {confirmTarget?.networkUsed}).
                </p>
                <p>The parent will be notified. You still need to record the payment manually in Fees.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === confirmTarget?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading === confirmTarget?.id}
              className="bg-green-600 hover:bg-green-700"
              onClick={(e) => {
                e.preventDefault();
                if (confirmTarget) void updateStatus(confirmTarget.id, 'reviewed');
              }}
            >
              {actionLoading === confirmTarget?.id ? 'Please wait…' : 'Yes, Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rejectTarget} onOpenChange={(open) => !open && !actionLoading && setRejectTarget(null)}>
        <AlertDialogContent className={paymentRejectDialogClass}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Reject payment submission?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Reject the GHS {Number(rejectTarget?.amountClaimed || 0).toLocaleString('en-GH', { minimumFractionDigits: 2 })}{' '}
                  submission for <strong>{rejectTarget?.studentName}</strong>? The parent will be notified.
                </p>
                <div>
                  <Label htmlFor="reject-notes">Reason (optional)</Label>
                  <Textarea
                    id="reject-notes"
                    value={rejectNotes}
                    onChange={(e) => setRejectNotes(e.target.value)}
                    placeholder="Explain why this proof was rejected…"
                    rows={3}
                    className="mt-1.5"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading === rejectTarget?.id}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionLoading === rejectTarget?.id}
              className="bg-red-600 hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                if (rejectTarget) void updateStatus(rejectTarget.id, 'rejected', rejectNotes);
              }}
            >
              {actionLoading === rejectTarget?.id ? 'Please wait…' : 'Yes, Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PaymentSubmissionsModule;
