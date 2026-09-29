import React, { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiService } from '../../services/api';
import { formatDisplayDate } from '../../utils/dateFormat';
import { toast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type CorrectionValues = {
  receipt_number?: string;
  root_receipt_number?: string;
  student_name?: string;
  student_label?: string;
  amount?: number;
  original_amount?: number;
  new_amount?: number;
  difference?: number;
  difference_direction?: string;
  amount_change_label?: string;
  correction_type?: string;
  payment_method?: string;
  payment_account_label?: string;
  payment_date?: string;
  payment_date_raw?: string;
  balance_before?: number;
  balance_after?: number;
  balance_outstanding_before?: number;
  balance_outstanding_after?: number;
  balance_credit_before?: number;
  balance_credit_after?: number;
  has_fees_assigned?: boolean;
  has_payments_recorded?: boolean;
  total_fees_before?: number;
  total_paid_before?: number;
  total_fees_after?: number;
  total_paid_after?: number;
  method_change_label?: string;
  date_change_label?: string;
};

type CorrectionRow = {
  id: number;
  created_at: string;
  correction_reason: string;
  corrected_by_name?: string;
  corrected_by_username?: string;
  before_values: CorrectionValues;
  after_values: CorrectionValues;
};

const PAGE_SIZE = 50;

function formatGhs(value: number | undefined | null) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `GHS ${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** DD/MM/YYYY — handles ISO, Date strings, and values already formatted by the backend. */
function formatAuditDate(value: unknown, fallback = '—'): string {
  if (value == null || value === '') return fallback;
  const raw = String(value).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return raw;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return formatDisplayDate(raw, fallback);
}

function formatBalanceSnapshot(values: CorrectionValues, phase: 'before' | 'after'): string {
  const outstanding =
    phase === 'before'
      ? (values.balance_before ?? values.balance_outstanding_before)
      : (values.balance_after ?? values.balance_outstanding_after);
  const credit =
    phase === 'before' ? values.balance_credit_before : values.balance_credit_after;
  const hasFees =
    values.has_fees_assigned === true ||
    (phase === 'before'
      ? (values.total_fees_before ?? 0) > 0
      : (values.total_fees_after ?? 0) > 0);
  const hasPayments =
    values.has_payments_recorded === true ||
    (phase === 'before'
      ? (values.total_paid_before ?? 0) > 0
      : (values.total_paid_after ?? 0) > 0);

  if (credit != null && Number(credit) > 0.0001) {
    return `${formatGhs(credit)} credit`;
  }
  if (outstanding != null && Number(outstanding) > 0.0001) {
    return formatGhs(outstanding);
  }
  if (hasFees || hasPayments) {
    return formatGhs(0);
  }
  return `${formatGhs(0)} (no fees assigned)`;
}

function formatBalanceChange(bv: CorrectionValues, av: CorrectionValues): string {
  return `${formatBalanceSnapshot(bv, 'before')} → ${formatBalanceSnapshot(av, 'after')}`;
}

function resolveMethodChange(bv: CorrectionValues, av: CorrectionValues): string {
  if (av.method_change_label) return av.method_change_label;
  const before = (bv.payment_account_label || bv.payment_method || '—').trim();
  const after = (av.payment_account_label || av.payment_method || '—').trim();
  if (before.toLowerCase() === after.toLowerCase()) return 'No change';
  return `${before} → ${after}`;
}

function resolveDateChange(bv: CorrectionValues, av: CorrectionValues): string {
  if (av.date_change_label) return av.date_change_label;
  const before = formatAuditDate(bv.payment_date_raw ?? bv.payment_date);
  const after = formatAuditDate(av.payment_date_raw ?? av.payment_date);
  if (before === after) return 'No change';
  return `${before} → ${after}`;
}

function formatCorrectionType(type?: string) {
  if (!type) return '—';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function DetailGrid({ row }: { row: CorrectionRow }) {
  const bv = row.before_values || {};
  const av = row.after_values || {};
  const amountChange =
    bv.amount_change_label ||
    (bv.amount != null && av.amount != null
      ? `${formatGhs(bv.amount)} → ${formatGhs(av.amount)}`
      : '—');
  const methodChange = resolveMethodChange(bv, av);
  const dateChange = resolveDateChange(bv, av);

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Date', value: formatAuditDate(row.created_at) },
    { label: 'By', value: row.corrected_by_name || row.corrected_by_username || '—' },
    { label: 'Student', value: av.student_label || bv.student_label || bv.student_name || '—' },
    { label: 'Original Receipt', value: bv.receipt_number || '—' },
    { label: 'New Receipt', value: av.receipt_number || '—' },
    { label: 'Correction Type', value: formatCorrectionType(bv.correction_type || av.correction_type) },
    { label: 'Amount Change', value: amountChange },
    { label: 'Balance Before', value: formatBalanceSnapshot(bv, 'before') },
    { label: 'Balance After', value: formatBalanceSnapshot(av, 'after') },
    { label: 'Method Change', value: methodChange },
    { label: 'Date Change', value: dateChange },
    { label: 'Reason', value: row.correction_reason || '—' },
  ];

  if (bv.root_receipt_number && bv.root_receipt_number !== bv.receipt_number) {
    fields.splice(4, 0, { label: 'Root Receipt', value: bv.root_receipt_number });
  }

  return (
    <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3 border-t bg-muted/20 px-4 py-4">
      {fields.map(({ label, value }) => (
        <div key={label} className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm text-foreground break-words">{value}</dd>
        </div>
      ))}
    </div>
  );
}

const ReceiptCorrectionsSection = () => {
  const [rows, setRows] = useState<CorrectionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(offset));
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const res = await apiService.get<{ items: CorrectionRow[]; total: number }>(
        `/payments/corrections?${params.toString()}`
      );
      let items = res.items || [];
      if (studentSearch.trim()) {
        const q = studentSearch.trim().toLowerCase();
        items = items.filter(
          (r) =>
            r.before_values?.student_name?.toLowerCase().includes(q) ||
            r.before_values?.student_label?.toLowerCase().includes(q) ||
            r.after_values?.student_name?.toLowerCase().includes(q) ||
            r.after_values?.student_label?.toLowerCase().includes(q)
        );
      }
      setRows(items);
      setTotal(res.total ?? 0);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to load receipt corrections',
        variant: 'destructive',
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [offset, startDate, endDate, studentSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-primary" />
          Receipt corrections
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Permanent record of every receipt correction. These entries cannot be deleted or modified.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => {
                setOffset(0);
                setStartDate(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => {
                setOffset(0);
                setEndDate(e.target.value);
              }}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Filter by student name</Label>
            <Input
              placeholder="Student name…"
              value={studentSearch}
              onChange={(e) => {
                setOffset(0);
                setStudentSearch(e.target.value);
              }}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="border-b">
                <TableHead className="w-8 px-2 py-2" />
                <TableHead className="px-2 py-2 text-xs font-semibold w-24">Date</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold min-w-[110px] max-w-[150px]">Student</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold min-w-[120px] max-w-[160px]">Original → New</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold w-20">Type</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold min-w-[110px] max-w-[140px]">Amount change</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold min-w-[90px] max-w-[120px]">Balance</TableHead>
                <TableHead className="px-2 py-2 text-xs font-semibold min-w-[120px] max-w-[160px]">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No receipt corrections found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const bv = row.before_values || {};
                  const av = row.after_values || {};
                  const expanded = expandedId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <TableRow
                        className={cn('cursor-pointer hover:bg-muted/40 border-b border-border/60', expanded && 'bg-muted/30')}
                        onClick={() => setExpandedId(expanded ? null : row.id)}
                      >
                        <TableCell className="px-2 py-2">
                          {expanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="px-2 py-2 whitespace-nowrap text-xs">
                          {formatAuditDate(row.created_at)}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs max-w-[150px] truncate" title={av.student_label || bv.student_label || bv.student_name || '—'}>
                          {av.student_label || bv.student_label || bv.student_name || '—'}
                        </TableCell>
                        <TableCell className="px-2 py-2 font-mono text-xs max-w-[160px] truncate">
                          {bv.receipt_number || '—'} → {av.receipt_number || '—'}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">
                          {formatCorrectionType(bv.correction_type || av.correction_type)}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs">
                          {bv.amount_change_label ||
                            `${formatGhs(bv.amount)} → ${formatGhs(av.amount)}`}
                        </TableCell>
                        <TableCell className="px-2 py-2 text-xs whitespace-nowrap">
                          {formatBalanceChange(bv, av)}
                        </TableCell>
                        <TableCell className="px-2 py-2 max-w-[160px] truncate text-xs" title={row.correction_reason}>
                          {row.correction_reason}
                        </TableCell>
                      </TableRow>
                      {expanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="p-0">
                            <DetailGrid row={row} />
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceiptCorrectionsSection;
