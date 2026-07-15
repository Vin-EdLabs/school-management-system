import React, { useEffect, useState } from 'react';
import { CheckCircle2, Mail, MessageSquareQuote, Phone, User } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  detailDialogBodyClass,
  detailDialogContentWideClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Completed',
  rejected: 'Rejected',
};

export default function WebsiteTestimonialDetailsDialog({
  submission,
  open,
  onClose,
  onMarkRead,
  onStatusChange,
  saving = false,
}: {
  submission: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onMarkRead: () => Promise<void>;
  onStatusChange: (status: string) => Promise<void>;
  saving?: boolean;
}) {
  const [status, setStatus] = useState(String(submission?.status || 'pending'));

  useEffect(() => {
    if (submission) setStatus(String(submission.status || 'pending'));
  }, [submission]);

  if (!submission) return null;

  const isRead = Boolean(submission.is_read);
  const notes = String(submission.message || '').trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-amber-600" />
            Testimonial letter request
            <Badge className={cn('font-medium', isRead ? 'bg-slate-100' : 'bg-amber-100 text-amber-800')}>
              {isRead ? 'Read' : 'New'}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {String(submission.full_name)}
            {submission.created_at ? ` · ${formatDisplayDate(String(submission.created_at))}` : ''}
          </p>
        </DialogHeader>
        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {String(submission.full_name)}
            </p>
            <p>
              <span className="text-muted-foreground">Year of completion:</span>{' '}
              {submission.completion_year ? String(submission.completion_year) : '—'}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {String(submission.phone)}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {submission.email ? String(submission.email) : 'No email'}
            </p>
          </div>
          {notes ? (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Purpose / notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Update status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s] || s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row')}>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
          {!isRead && (
            <Button type="button" variant="outline" className="rounded-xl gap-1.5" disabled={saving} onClick={() => void onMarkRead()}>
              <CheckCircle2 className="h-4 w-4" />
              Mark read
            </Button>
          )}
          <Button
            type="button"
            className="rounded-xl"
            disabled={saving || status === String(submission.status)}
            onClick={() => void onStatusChange(status)}
          >
            Save status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
