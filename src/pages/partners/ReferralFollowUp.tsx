import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const STEPS = [
  { key: 'new', label: 'Submitted' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'demo_booked', label: 'Demo set' },
  { key: 'converted', label: 'Live' },
] as const;

const STATUS_ORDER: Record<string, number> = {
  new: 0,
  contacted: 1,
  demo_booked: 2,
  converted: 3,
  dead: -1,
};

export function referralProgressScore(status: string): number {
  if (status === 'dead') return 0;
  const idx = STATUS_ORDER[status] ?? 0;
  if (idx >= 3) return 100;
  return Math.round(((idx + 1) / STEPS.length) * 100);
}

export function ReferralProgressTrack({ status }: { status: string }) {
  const dead = status === 'dead';
  const current = dead ? -1 : (STATUS_ORDER[status] ?? 0);
  const score = referralProgressScore(status);

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Follow-up score</span>
        <span className={cn(
          'text-sm font-black tabular-nums',
          dead ? 'text-slate-400' : score >= 100 ? 'text-emerald-600' : 'text-emerald-700 dark:text-emerald-400',
        )}
        >
          {dead ? '—' : `${score}%`}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            dead ? 'w-0 bg-slate-300' : 'bg-gradient-to-r from-emerald-500 to-teal-500',
          )}
          style={{ width: dead ? '0%' : `${Math.max(score, 8)}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {STEPS.map((step, i) => {
          const done = !dead && current >= i;
          const active = !dead && current === i;
          return (
            <div key={step.key} className="text-center">
              <div
                className={cn(
                  'mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition',
                  done
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : active
                      ? 'bg-emerald-100 text-emerald-800 ring-2 ring-emerald-400 dark:bg-emerald-950 dark:text-emerald-200'
                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800',
                )}
              >
                {done ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
              </div>
              <p className={cn(
                'mt-1 text-[9px] font-semibold leading-tight',
                done || active ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-400',
              )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SchoolMeetingLinkBlock({
  schoolName,
  url,
  demoDate,
}: {
  schoolName: string;
  url: string;
  demoDate?: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50/90 to-white p-3.5 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-slate-900/40">
      <div className="flex items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white">
          <Link2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">Demo meeting link</p>
          <p className="mt-0.5 text-[13px] font-semibold text-slate-900 dark:text-white">{schoolName}</p>
          {demoDate ? (
            <p className="mt-0.5 text-[11px] text-slate-500">
              Scheduled:{' '}
              {new Date(demoDate).toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="snp-demo-link-url min-w-0 flex-1 truncate rounded-lg border border-violet-100 bg-white/90 px-2.5 py-2 text-[11px] font-medium text-violet-900 dark:border-violet-900/30 dark:bg-slate-950/50 dark:text-violet-200">
          {url}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button type="button" size="sm" variant="outline" onClick={() => void copy()} className="h-8 rounded-lg text-xs font-bold">
            {copied ? <><Check className="mr-1 h-3 w-3" /> Copied</> : <><Copy className="mr-1 h-3 w-3" /> Copy</>}
          </Button>
          <Button type="button" size="sm" asChild className="h-8 rounded-lg bg-violet-600 text-xs font-bold hover:bg-violet-700">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" /> Join
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
