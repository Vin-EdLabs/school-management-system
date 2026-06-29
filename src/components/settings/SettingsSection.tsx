import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

export const SETTINGS_CARD_CLASS =
  'rounded-2xl border border-border/60 bg-card shadow-sm transition-shadow hover:shadow-md overflow-hidden';

type SettingsSectionProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: 'emerald' | 'blue' | 'purple' | 'amber' | 'slate';
  children: React.ReactNode;
  className?: string;
};

const accentStyles = {
  emerald: {
    icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20',
    line: 'from-emerald-500/40 via-emerald-500/10 to-transparent',
  },
  blue: {
    icon: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20',
    line: 'from-blue-500/40 via-blue-500/10 to-transparent',
  },
  purple: {
    icon: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 ring-purple-500/20',
    line: 'from-purple-500/40 via-purple-500/10 to-transparent',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20',
    line: 'from-amber-500/40 via-amber-500/10 to-transparent',
  },
  slate: {
    icon: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/20',
    line: 'from-slate-400/30 via-slate-400/10 to-transparent',
  },
};

export function SettingsSection({
  icon: Icon,
  title,
  description,
  accent = 'slate',
  children,
  className,
}: SettingsSectionProps) {
  const styles = accentStyles[accent];
  return (
    <section className={cn('space-y-4', className)}>
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1',
            styles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="text-base font-bold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted-foreground leading-relaxed">{description}</p>
          ) : null}
          <div className={cn('mt-3 h-px w-full max-w-md bg-gradient-to-r', styles.line)} />
        </div>
      </div>
      {children}
    </section>
  );
}

export function SettingsPageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-5 py-5 shadow-sm dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl" />
      <div className="relative flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg shadow-slate-900/20">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  );
}
