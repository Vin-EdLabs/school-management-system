import { cn } from '@/lib/utils';

const STYLES: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
  abandoned: 'bg-slate-100 text-slate-600 border-slate-200',
};

const LABELS: Record<string, string> = {
  success: 'Success',
  pending: 'Pending',
  failed: 'Failed',
  abandoned: 'Abandoned',
};

export default function PaymentStatusBadge({
  status,
  className,
}: {
  status: 'pending' | 'success' | 'failed' | 'abandoned' | string;
  className?: string;
}) {
  const key = String(status || 'pending').toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide',
        STYLES[key] || STYLES.pending,
        className
      )}
    >
      {LABELS[key] || key}
    </span>
  );
}
