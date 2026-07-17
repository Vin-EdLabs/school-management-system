import React, { useMemo } from 'react';
import { Receipt, Wallet } from 'lucide-react';
import { usePartnerSession } from './partnerSession';
import {
  MonthName, PartnerPage, PartnerPageHeader, PortalCard, VirtualEarningsCard,
} from './partnerShared';
import { PartnerCommissionsSkeleton } from './PartnerLoading';
import { usePartnerCommissions } from './usePartnerQueries';
import { formatGhs } from '@/utils/currency';

function SummaryCard({ label, amount, delay = 0 }: { label: string; amount: number; delay?: number }) {
  return (
    <PortalCard className="snp-fade-up p-4 sm:p-5" style={{ animationDelay: `${delay}ms` }}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold leading-none text-emerald-600 dark:text-emerald-400 sm:text-2xl">
        {formatGhs(amount)}
      </p>
    </PortalCard>
  );
}

function StatusPill({ status }: { status: 'pending' | 'paid' }) {
  return status === 'paid' ? (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
      Paid
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      Pending
    </span>
  );
}

export default function PartnerCommissions() {
  const { partner, stats } = usePartnerSession();
  const { data, isLoading } = usePartnerCommissions();

  const summary = data?.summary || { thisMonth: 0, lastMonth: 0, totalLifetime: 0, pendingPayout: 0 };
  const records = data?.records || [];
  const payouts = data?.payouts || [];

  const growthPct = useMemo(() => {
    if (summary.lastMonth > 0) {
      return Math.round(((summary.thisMonth - summary.lastMonth) / summary.lastMonth) * 100);
    }
    return summary.thisMonth > 0 ? 100 : 0;
  }, [summary.thisMonth, summary.lastMonth]);

  if (isLoading) {
    return <PartnerCommissionsSkeleton />;
  }

  return (
    <PartnerPage>
      <PartnerPageHeader title="Commissions" subtitle="Your earnings, payout history, and monthly commission records." />

      <VirtualEarningsCard
        partner={partner}
        stats={stats}
        thisMonth={summary.thisMonth}
        growthPct={growthPct}
        pending={partner.status === 'pending'}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="This Month" amount={summary.thisMonth} delay={0} />
        <SummaryCard label="Last Month" amount={summary.lastMonth} delay={60} />
        <SummaryCard label="Total Lifetime" amount={summary.totalLifetime} delay={120} />
        <SummaryCard label="Pending Payout" amount={summary.pendingPayout} delay={180} />
      </div>

      <PortalCard className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Commission records</h2>
        </div>
        {records.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            Commissions appear here once your first school converts.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {records.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{r.school_name || 'School'}</p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {MonthName(r.month)} {r.year} · {formatGhs(Number(r.plan_amount))} plan · {Number(r.commission_rate)}%
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatGhs(Number(r.commission_amount))}</span>
                  <StatusPill status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PortalCard>

      <PortalCard className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Payout history</h2>
        </div>
        {payouts.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">No payouts yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {payouts.map((p) => (
              <div key={`payout-${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {p.school_name || 'School'} — {MonthName(p.month)} {p.year}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {p.paid_at
                      ? `Paid ${new Date(p.paid_at).toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : 'Paid'}
                    {p.momo_reference ? ` · Ref: ${p.momo_reference}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-base font-bold text-emerald-600 dark:text-emerald-400">
                  {formatGhs(Number(p.commission_amount))}
                </span>
              </div>
            ))}
          </div>
        )}
      </PortalCard>
    </PartnerPage>
  );
}
