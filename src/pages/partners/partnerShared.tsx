import React from 'react';
import type { PartnerTier } from '@/services/partnerApi';
import { TIER_META } from '@/services/partnerApi';
import { Crown, Medal, Star, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

export const TIER_ICONS: Record<PartnerTier, React.ComponentType<{ className?: string }>> = {
  partner: Star,
  senior_partner: Medal,
  team_leader: Trophy,
  regional_director: Crown,
};

export function TierBadge({ tier, size = 'sm' }: { tier: PartnerTier; size?: 'sm' | 'lg' }) {
  const meta = TIER_META[tier];
  const Icon = TIER_ICONS[tier];
  const premium = tier === 'team_leader' || tier === 'regional_director';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-semibold',
        size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-2.5 py-0.5 text-xs',
        premium
          ? 'border border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
      )}
    >
      <Icon className={size === 'lg' ? 'h-4 w-4' : 'h-3 w-3'} />
      {meta.label}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    new: {
      label: 'New',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    },
    contacted: {
      label: 'Contacted',
      cls: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
    },
    demo_booked: {
      label: 'Demo Booked',
      cls: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
    },
    converted: {
      label: 'Converted',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    },
    dead: {
      label: 'Inactive',
      cls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    },
    inactive: {
      label: 'Inactive',
      cls: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
    },
  };
  const meta = map[status] || map.new;
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', meta.cls)}>
      {meta.label}
    </span>
  );
}

export function MonthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' });
}

export function PortalCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={cn(
        'snp-glass-card rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(8,80,65,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90 dark:shadow-none',
        className
      )}
    >
      {children}
    </div>
  );
}

export {
  PartnerPage,
  PartnerPageHeader,
  PartnerDarkHero,
  VirtualEarningsCard,
  PartnerStatGrid,
  PartnerActivityList,
  PartnerAvatar,
  PartnerPhotoUpload,
  PartnerEmptyState,
} from './partnerPremium';
export type { StatTileDef, ActivityItem } from './partnerPremium';
