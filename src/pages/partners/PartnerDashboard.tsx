import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarCheck, ClipboardCheck, Receipt, RefreshCw, Send, User, Users, Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePartnerSession } from './partnerSession';
import { TIER_META, type PartnerActivityItem } from '@/services/partnerApi';
import { formatGhs } from '@/utils/currency';
import {
  PartnerActivityList,
  PartnerPage,
  PartnerStatGrid,
  VirtualEarningsCard,
  type ActivityItem,
  type StatTileDef,
} from './partnerShared';
import PartnerHomeSections from './PartnerHomeSections';
import './partners.css';

function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

function mapActivity(items: PartnerActivityItem[]): ActivityItem[] {
  const iconMap = {
    commission: Receipt,
    lead: Send,
    notification: Bell,
  } as const;

  return items.map((item) => ({
    id: item.id,
    title: item.title,
    time: formatActivityTime(item.createdAt),
    right: item.kind === 'commission' ? formatGhs(Number(item.right)) : item.right,
    tone: item.tone,
    icon: iconMap[item.kind],
  }));
}

function formatSyncTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function PartnerDashboard() {
  const navigate = useNavigate();
  const { partner, stats, recentActivity, refresh } = usePartnerSession();
  const isPending = partner.status === 'pending';
  const [lockTip, setLockTip] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState(() => new Date());

  useEffect(() => {
    setLastSync(new Date());
  }, [stats, recentActivity, partner.status]);

  const thisMonth = stats.thisMonthEarnings ?? 0;
  const lastMonthEarnings = stats.lastMonthEarnings ?? 0;

  const growthPct = useMemo(() => {
    if (lastMonthEarnings > 0) {
      return Math.round(((thisMonth - lastMonthEarnings) / lastMonthEarnings) * 100);
    }
    return thisMonth > 0 ? 100 : 0;
  }, [thisMonth, lastMonthEarnings]);

  const tierLabel = TIER_META[partner.tier]?.label ?? 'Partner';
  const activityItems = useMemo(() => mapActivity(recentActivity), [recentActivity]);

  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
      setLastSync(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refresh, refreshing]);

  const statTiles: StatTileDef[] = [
    { icon: Users, value: String(stats.totalSchools), label: 'Schools Referred', sub: 'Total', tone: 'green', locked: isPending },
    { icon: CalendarCheck, value: String(stats.activeSchools), label: 'Active Schools', sub: 'Earning', tone: 'blue', locked: isPending },
    { icon: ClipboardCheck, value: formatGhs(thisMonth).replace('.00', ''), label: 'This Month', sub: 'Commissions', tone: 'gold', locked: isPending },
    { icon: Send, value: String(stats.totalSchools), label: 'Referrals', sub: 'Submitted', tone: 'blue', locked: isPending },
    { icon: User, value: tierLabel, label: 'My Tier', sub: 'Active', tone: 'purple', locked: isPending },
    { icon: Wallet, value: formatGhs(stats.totalEarned).replace('.00', ''), label: 'Total Paid', sub: 'Settled', tone: 'red', locked: isPending },
  ];

  return (
    <PartnerPage>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
            Hello, {partner.firstName}
          </h1>
          <p className="mt-0.5 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span className="snp-live-dot inline-block h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
            Live · updated {formatSyncTime(lastSync)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/85 px-4 py-2 text-sm font-bold text-emerald-800 shadow-sm backdrop-blur-sm transition hover:border-emerald-300 hover:bg-white disabled:opacity-60 dark:border-emerald-900/50 dark:bg-slate-900/80 dark:text-emerald-200"
          aria-label="Refresh dashboard"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <VirtualEarningsCard
        partner={partner}
        stats={stats}
        thisMonth={thisMonth}
        growthPct={growthPct}
        pending={isPending}
      />

      <PartnerStatGrid
        items={statTiles}
        onLockedTap={() => {
          setLockTip(true);
          window.setTimeout(() => setLockTip(false), 2500);
        }}
      />

      {lockTip ? (
        <p className="text-center text-xs font-semibold text-slate-400">Stats unlock after approval — read How it Works below anytime</p>
      ) : null}

      <PartnerActivityList
        items={isPending ? [] : activityItems}
        emptyMessage={
          isPending
            ? 'Your activity will appear here once approved'
            : 'No recent activity yet'
        }
        onViewAll={isPending ? undefined : () => navigate('/commissions')}
      />

      <PartnerHomeSections />
    </PartnerPage>
  );
}
