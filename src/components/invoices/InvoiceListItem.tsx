import React from 'react';
import { cn } from '@/lib/utils';
import type { Invoice } from '@/services/invoiceApi';

type InvoiceListItemProps = {
  invoice: Invoice;
  selected?: boolean;
  onSelect: () => void;
};

const InvoiceListItem: React.FC<InvoiceListItemProps> = ({ invoice, selected, onSelect }) => (
  <button
    type="button"
    onClick={onSelect}
    className={cn(
      'w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-800 transition-colors',
      selected
        ? 'bg-indigo-600 text-white border-indigo-600'
        : 'hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
    )}
  >
    <p className={cn('text-sm font-semibold truncate', selected ? 'text-white' : 'text-foreground')}>
      {invoice.studentName || 'Student'}
    </p>
    <p className={cn('text-xs truncate mt-0.5', selected ? 'text-indigo-100' : 'text-muted-foreground')}>
      {invoice.studentCode || '—'}
    </p>
    <p className={cn('text-xs truncate', selected ? 'text-indigo-100/90' : 'text-muted-foreground')}>
      {invoice.className || '—'}
    </p>
  </button>
);

export default InvoiceListItem;
