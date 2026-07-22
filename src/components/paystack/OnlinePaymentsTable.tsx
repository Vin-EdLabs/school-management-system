import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import PaymentStatusBadge from '@/components/payments/PaymentStatusBadge';
import { fetchOnlinePayments, type OnlinePaymentRow } from '@/services/onlinePaymentApi';
import { formatDisplayDateTime } from '@/utils/dateFormat';
import { formatGhs } from '@/utils/currency';

export default function OnlinePaymentsTable() {
  const [rows, setRows] = useState<OnlinePaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [summary, setSummary] = useState({ totalCollectedGhs: 0, transactionsThisMonth: 0, topChannel: null as string | null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOnlinePayments({ search: search.trim() || undefined, status: status || undefined, limit: 100 });
      setRows(data.rows);
      setSummary(data.summary);
    } catch (e: unknown) {
      toast({ title: 'Could not load payments', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total collected</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{formatGhs(summary.totalCollectedGhs)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">This month</p>
          <p className="mt-1 text-2xl font-black text-slate-900">{summary.transactionsThisMonth}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Top channel</p>
          <p className="mt-1 text-lg font-bold capitalize text-slate-900">{summary.topChannel || '—'}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            placeholder="Search student or reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="rounded-xl border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="success">Success</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <Button type="button" variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading transactions…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-500">No online payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Fee</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDisplayDateTime(r.paid_at || r.created_at)}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.studentName}</td>
                    <td className="px-4 py-3">{formatGhs(r.amountGhs)}</td>
                    <td className="px-4 py-3 text-slate-500">{formatGhs(r.feeGhs)}</td>
                    <td className="px-4 py-3 font-semibold">{formatGhs(r.totalGhs)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{r.payment_channel || '—'}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={r.status} /></td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
