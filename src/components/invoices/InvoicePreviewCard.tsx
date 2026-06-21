import React from 'react';
import { FileText, Printer, FileDown, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDisplayDate } from '@/utils/dateFormat';
import { invoiceStatusClass, invoiceStatusLabel, type Invoice } from '@/services/invoiceApi';
import { cn } from '@/lib/utils';

type InvoicePreviewCardProps = {
  invoice: Invoice;
  selected?: boolean;
  loading?: boolean;
  onSelect: () => void;
  onPrint: () => void;
  onDownload: () => void;
};

const InvoicePreviewCard: React.FC<InvoicePreviewCardProps> = ({
  invoice,
  selected,
  loading,
  onSelect,
  onPrint,
  onDownload,
}) => {
  const status = invoice.liveStatus || invoice.status;

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card shadow-sm transition-all cursor-pointer',
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/30 shadow-md'
          : 'border-border/60 hover:border-indigo-300 hover:shadow-md'
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      role="button"
      tabIndex={0}
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-600" />
      <div className="p-4 pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-indigo-600">{invoice.invoiceNumber}</p>
            <p className="mt-1 font-semibold text-foreground truncate">{invoice.studentName}</p>
            <p className="text-xs text-muted-foreground truncate">{invoice.className || '—'}</p>
          </div>
          <Badge variant="outline" className={cn('shrink-0 text-[10px]', invoiceStatusClass(status))}>
            {invoiceStatusLabel(status)}
          </Badge>
        </div>

        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-3 space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Issue date</span>
            <span>{formatDisplayDate(invoice.issueDate)}</span>
          </div>
          {invoice.dueDate ? (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Due date</span>
              <span>{formatDisplayDate(invoice.dueDate)}</span>
            </div>
          ) : null}
          <div className="flex justify-between items-center pt-1 border-t border-slate-200/80 dark:border-slate-700">
            <span className="text-xs font-medium text-muted-foreground">Balance due</span>
            <span className="text-base font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
              GHS {(invoice.outstanding ?? invoice.totalDue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs gap-1 rounded-lg"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              onPrint();
            }}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
            Print
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 h-8 text-xs gap-1 rounded-lg"
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              onDownload();
            }}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />}
            PDF
          </Button>
        </div>
      </div>
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
          <FileText className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
};

export default InvoicePreviewCard;
