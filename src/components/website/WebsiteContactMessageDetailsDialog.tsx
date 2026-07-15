import React from 'react';
import { CheckCircle2, Mail, MessageSquare, Phone, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';

export default function WebsiteContactMessageDetailsDialog({
  message,
  open,
  onClose,
  onMarkRead,
  markingRead = false,
}: {
  message: Record<string, unknown> | null;
  open: boolean;
  onClose: () => void;
  onMarkRead: () => Promise<void>;
  markingRead?: boolean;
}) {
  if (!message) return null;

  const isRead = Boolean(message.is_read);
  const email = String(message.email || '').trim();
  const phone = String(message.phone || '').trim();
  const name = String(message.name || '').trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={`${detailDialogContentWideClass} sm:max-w-2xl`}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <MessageSquare className="h-5 w-5 text-sky-600" />
            Contact message
            <Badge
              className={cn(
                'font-medium',
                isRead ? 'bg-slate-100 text-slate-700' : 'bg-sky-100 text-sky-800'
              )}
            >
              {isRead ? 'Read' : 'New'}
            </Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {name || 'Unknown sender'}
            {message.created_at ? ` · ${formatDisplayDate(String(message.created_at))}` : ''}
          </p>
        </DialogHeader>

        <DialogBody className={`${detailDialogBodyClass} space-y-5`}>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <p className="flex items-center gap-2">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">{name || '—'}</span>
            </p>
            <p className="flex min-w-0 items-center gap-2">
              <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
              {phone ? (
                <a href={`tel:${phone.replace(/\s/g, '')}`} className="truncate text-primary hover:underline">
                  {phone}
                </a>
              ) : (
                <span>—</span>
              )}
            </p>
            <p className="flex min-w-0 items-center gap-2 md:col-span-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              {email ? (
                <a href={`mailto:${email}`} className="truncate text-primary hover:underline">
                  {email}
                </a>
              ) : (
                <span className="text-muted-foreground">No email provided</span>
              )}
            </p>
          </div>

          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Message</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
              {String(message.message || '—')}
            </p>
          </div>
        </DialogBody>

        <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row sm:justify-end')}>
          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
          {!isRead ? (
            <Button
              type="button"
              className="rounded-xl gap-1.5"
              disabled={markingRead}
              onClick={() => void onMarkRead()}
            >
              <CheckCircle2 className="h-4 w-4" />
              {markingRead ? 'Marking…' : 'Mark as read'}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
