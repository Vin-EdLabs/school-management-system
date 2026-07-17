import React, { useRef, useState } from 'react';
import {
  Camera, ChevronRight, Loader2, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { formatGhs } from '@/utils/currency';
import type { PartnerProfile, PartnerStats } from '@/services/partnerApi';
import { TIER_META, partnerApi } from '@/services/partnerApi';

/* ── Layout ── */

export function PartnerPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('snp-page snp-fade-up mx-auto w-full max-w-5xl space-y-5 px-4 py-5 sm:space-y-6 sm:p-6', className)}>
      {children}
    </div>
  );
}

export function PartnerPageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 sm:text-[15px]">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function PartnerDarkHero({
  eyebrow,
  title,
  subtitle,
  chips,
  children,
}: {
  eyebrow: React.ReactNode;
  title: string;
  subtitle?: string;
  chips?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="snp-dark-hero relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 p-5 text-white shadow-xl sm:p-7">
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-emerald-400/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-10 h-32 w-32 rounded-full bg-amber-400/10 blur-2xl" />
      <div className="relative space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-100 ring-1 ring-emerald-400/30">
          {eyebrow}
        </div>
        <h2 className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
        {subtitle ? <p className="max-w-xl text-sm text-emerald-100/80">{subtitle}</p> : null}
        {chips}
        {children}
      </div>
    </div>
  );
}

/* ── Virtual earnings card ── */

export function VirtualEarningsCard({
  partner,
  stats,
  thisMonth,
  growthPct,
  pending = false,
}: {
  partner: PartnerProfile;
  stats: PartnerStats;
  thisMonth: number;
  growthPct: number;
  pending?: boolean;
}) {
  const tierLabel = TIER_META[partner.tier]?.label ?? 'Partner';

  return (
    <div className="snp-virtual-card relative overflow-hidden rounded-2xl p-4 text-white shadow-[0_12px_36px_rgba(8,80,65,0.28)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(201,162,39,0.22),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(13,158,117,0.3),transparent_50%)]" />
      <div className="pointer-events-none absolute bottom-2 right-3 text-[3rem] font-black leading-none text-white/[0.04]">SN</div>

      <div className="relative flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100/70 italic">
          ScholarNerve Partners
        </p>
        <div className="rounded-full border border-amber-300/35 bg-amber-400/12 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100">
          {tierLabel}
        </div>
      </div>

      {pending ? (
        <div className="relative mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/65">Application Status</p>
          <p className="mt-0.5 flex items-center gap-2 text-xl font-black">
            Under Review
            <span className="snp-pending-dot inline-block h-2 w-2 rounded-full bg-amber-400" />
          </p>
          <p className="mt-1 text-xs text-emerald-100/70">You&apos;ll hear from us within 48 hours</p>
        </div>
      ) : (
        <>
          <div className="relative mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-100/65">Available Earnings</p>
              <p className="mt-0.5 text-2xl font-black leading-none tracking-tight">
                {formatGhs(thisMonth)}
              </p>
            </div>
            <p className="flex items-center gap-1 text-xs font-semibold text-emerald-200">
              <TrendingUp className="h-3.5 w-3.5 text-amber-300" />
              {growthPct >= 0 ? '+' : ''}{growthPct}%
            </p>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2 border-t border-white/12 pt-3">
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/55">Schools</p>
              <p className="mt-0.5 text-sm font-bold">{stats.activeSchools}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/55">Lifetime</p>
              <p className="mt-0.5 text-sm font-bold">{formatGhs(stats.totalEarned).replace('.00', '')}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold uppercase tracking-wide text-emerald-100/55">Pending</p>
              <p className="mt-0.5 text-sm font-bold text-amber-200">{formatGhs(stats.pendingPayout).replace('.00', '')}</p>
            </div>
          </div>
        </>
      )}

      {!pending && partner.partnerId ? (
        <p className="relative mt-3 font-mono text-[10px] tracking-[0.18em] text-emerald-100/45">
          {partner.partnerId}
        </p>
      ) : null}
    </div>
  );
}

/* ── Stat tiles ── */

export type StatTileDef = {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
  sub?: string;
  tone?: 'green' | 'gold' | 'blue' | 'orange' | 'purple' | 'red';
  locked?: boolean;
};

const TONE_CLASS: Record<NonNullable<StatTileDef['tone']>, string> = {
  green: 'snp-stat-tone-green',
  gold: 'snp-stat-tone-gold',
  blue: 'snp-stat-tone-blue',
  orange: 'snp-stat-tone-orange',
  purple: 'snp-stat-tone-purple',
  red: 'snp-stat-tone-red',
};

export function PartnerStatGrid({
  items,
  onLockedTap,
}: {
  items: StatTileDef[];
  onLockedTap?: () => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <Card
            key={item.label}
            className={cn('snp-stat-card snp-fade-up relative overflow-hidden border-white/80 dark:border-slate-700/80', TONE_CLASS[item.tone || 'green'])}
            style={{ animationDelay: `${i * 45}ms` }}
          >
            <CardContent className="p-3.5 sm:p-4">
              <div className="snp-stat-icon-wrap mb-2">
                <Icon className="h-[16px] w-[16px]" />
              </div>
              <p className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-xl">{item.value}</p>
              <p className="mt-0.5 text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</p>
              {item.sub ? <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{item.sub}</p> : null}
              {item.locked ? (
                <button
                  type="button"
                  className="snp-stat-lock"
                  onClick={onLockedTap}
                  aria-label="Locked until approval"
                />
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Activity list ── */

export type ActivityItem = {
  id: string;
  title: string;
  time: string;
  right: string;
  tone?: 'green' | 'orange' | 'blue';
  icon: React.ComponentType<{ className?: string }>;
};

export function PartnerActivityList({
  items,
  emptyMessage,
  onViewAll,
}: {
  items: ActivityItem[];
  emptyMessage?: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="snp-glass-card overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(8,80,65,0.06)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800 sm:px-5">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Recent Activity</h3>
        {onViewAll ? (
          <button type="button" onClick={onViewAll} className="flex items-center gap-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            View all <ChevronRight className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400 dark:text-slate-500">{emptyMessage || 'No activity yet'}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((row) => {
            const Icon = row.icon;
            return (
              <li key={row.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className={cn('snp-activity-icon', row.tone && `tone-${row.tone}`)}>
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{row.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{row.time}</p>
                </div>
                <span className={cn('shrink-0 text-sm font-bold', row.tone === 'green' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200')}>
                  {row.right}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Avatar + photo upload ── */

export function PartnerAvatar({
  partner,
  size = 'md',
  className,
}: {
  partner: Pick<PartnerProfile, 'firstName' | 'lastName' | 'profilePhotoUrl'>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const initials = `${partner.firstName?.[0] || ''}${partner.lastName?.[0] || ''}`.toUpperCase();
  const sizeClass = size === 'lg' ? 'h-20 w-20 text-xl' : size === 'sm' ? 'h-9 w-9 text-xs' : 'h-14 w-14 text-base';
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border-2 border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-amber-50 font-extrabold text-emerald-800 shadow-md',
        sizeClass,
        className
      )}
    >
      {partner.profilePhotoUrl ? (
        <img src={partner.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center">{initials}</span>
      )}
    </div>
  );
}

export function PartnerPhotoUpload({
  partner,
  onUploaded,
}: {
  partner: PartnerProfile;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please choose a photo (JPG or PNG)');
      return;
    }
    if (file.size > 2_500_000) {
      setError('Photo must be under 2.5 MB');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await partnerApi.put('/partners/profile', { profilePhotoUrl: dataUrl });
      onUploaded();
    } catch {
      setError('Could not upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        className="group relative"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <PartnerAvatar partner={partner} size="lg" />
        <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-lg transition group-hover:bg-emerald-700">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
      </button>
      <p className="text-center text-xs text-slate-500">Tap to update your partner photo for your ID card</p>
      {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/* ── Premium empty state ── */

export function PartnerEmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="snp-glass-card flex flex-col items-center rounded-2xl border border-white/80 bg-white/95 px-6 py-14 text-center shadow-[0_18px_45px_rgba(8,80,65,0.07)] backdrop-blur-sm dark:border-slate-700/80 dark:bg-slate-900/90">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 ring-1 ring-emerald-100 dark:from-emerald-950/50 dark:to-teal-950/30 dark:ring-emerald-800">
        <Icon className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">{body}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
