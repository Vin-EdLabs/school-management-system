import React, { useMemo, useState } from 'react';
import { Briefcase, Mail, Phone, User } from 'lucide-react';
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
import { WebsiteDocumentGrid, type WebsiteDocument } from './WebsiteDocumentPreview';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};

function statusBadgeClass(status: string) {
  switch (status) {
    case 'accepted':
      return 'bg-emerald-100 text-emerald-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    case 'under_review':
      return 'bg-blue-100 text-blue-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export default function WebsiteEmploymentDetailsDialog({
  application,
  open,
  onClose,
  onStatusChange,
  saving = false,
}: {
  application: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => Promise<void>;
  saving?: boolean;
}) {
  const row = application;
  const [status, setStatus] = useState(String(row?.status || 'pending'));

  React.useEffect(() => {
    if (row) setStatus(String(row.status || 'pending'));
  }, [row]);

  const documents = useMemo(() => {
    const raw = row?.documents;
    if (Array.isArray(raw)) return raw as WebsiteDocument[];
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as WebsiteDocument[];
      } catch {
        return [];
      }
    }
    return [];
  }, [row?.documents]);

  if (!row) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-3xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Briefcase className="h-5 w-5 text-emerald-600" />
            Employment application
            <Badge className={cn('font-medium', statusBadgeClass(String(row.status || 'pending')))}>
              {STATUS_LABELS[String(row.status || 'pending')] || String(row.status)}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {String(row.full_name || '')}
            {row.submitted_at ? ` · ${formatDisplayDate(String(row.submitted_at))}` : ''}
          </p>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-5`}>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{String(row.full_name || '')}</span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>{String(row.email || '')}</span>
            </p>
            {row.phone ? (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{String(row.phone)}</span>
              </p>
            ) : null}
            {row.position_applied ? (
              <p className="flex items-center gap-2 md:col-span-2">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{String(row.position_applied)}</span>
              </p>
            ) : null}
          </div>

          {row.message ? (
            <div className="rounded-xl border bg-muted/20 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{String(row.message)}</p>
            </div>
          ) : null}

          {documents.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Attachments</p>
              <WebsiteDocumentGrid documents={documents} />
            </div>
          ) : null}
        </DialogBody>

        <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-3 sm:flex-row sm:items-end')}>
          <div className="w-full sm:max-w-xs space-y-1.5">
            <Label className="text-xs text-muted-foreground">Update status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(['pending', 'under_review', 'accepted', 'rejected'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
              Close
            </Button>
            <Button
              type="button"
              className="rounded-xl"
              disabled={saving || status === String(row.status)}
              onClick={() => void onStatusChange(status)}
            >
              Save status
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
