import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Mail, Phone, User } from 'lucide-react';
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

function docLabel(type: string) {
  if (type === 'bece') return 'BECE Results';
  if (type === 'both') return 'Transcript & BECE';
  if (type === 'testimonial') return 'Testimonial Letter';
  return 'School Transcript';
}

export default function WebsiteTranscriptDetailsDialog({
  request,
  open,
  onClose,
  onMarkRead,
  onStatusChange,
  saving = false,
}: {
  request: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onMarkRead: () => Promise<void>;
  onStatusChange: (status: string) => Promise<void>;
  saving?: boolean;
}) {
  const [status, setStatus] = useState(String(request?.status || 'pending'));

  useEffect(() => {
    if (request) setStatus(String(request.status || 'pending'));
  }, [request]);

  if (!request) return null;

  const isRead = Boolean(request.is_read);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <FileText className="h-5 w-5 text-violet-600" />
            Document request
            <Badge className={cn('font-medium', isRead ? 'bg-slate-100' : 'bg-violet-100 text-violet-800')}>
              {isRead ? 'Read' : 'New'}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {String(request.full_name)}
            {request.created_at ? ` · ${formatDisplayDate(String(request.created_at))}` : ''}
          </p>
        </DialogHeader>
        <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {String(request.full_name)}
            </p>
            <p>
              <span className="text-muted-foreground">Year:</span> {String(request.completion_year)}
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              {String(request.phone)}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {request.email ? String(request.email) : 'No email'}
            </p>
          </div>
          <p className="text-sm">
            <span className="font-medium">Document:</span> {docLabel(String(request.document_type || 'transcript'))}
          </p>
          {request.notes ? (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{String(request.notes)}</p>
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Update status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['pending', 'processing', 'completed', 'rejected'] as const).map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
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
            disabled={saving || status === String(request.status)}
            onClick={() => void onStatusChange(status)}
          >
            Save status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
