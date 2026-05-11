import React from 'react';
import { GraduationCap } from 'lucide-react';

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');

function resolveLogo(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${API_ROOT}${url.startsWith('/') ? '' : '/'}${url}`;
}

type BrandedLoadingProps = {
  /** School logo URL (relative or absolute). */
  logoUrl?: string | null;
  /** Short status line (no “LOODING” typos). */
  label?: string;
  className?: string;
  /** Dark backdrop (e.g. parent portal route). */
  tone?: 'default' | 'dark';
};

/**
 * Full-screen or card-style loading with optional school logo and smooth spinner.
 */
export function BrandedLoading({ logoUrl, label = 'Loading…', className = '', tone = 'default' }: BrandedLoadingProps) {
  const resolved = resolveLogo(logoUrl);
  const ring = tone === 'dark' ? 'border-white/15 border-t-purple-400' : 'border-indigo-100 border-t-indigo-600';
  const panel = tone === 'dark' ? 'bg-white/10 shadow-md ring-1 ring-white/15' : 'bg-white shadow-md ring-1 ring-slate-200/80';
  const cap = tone === 'dark' ? 'text-purple-300' : 'text-indigo-500';
  const caption = tone === 'dark' ? 'text-purple-200/90' : 'text-slate-600';
  return (
    <div
      className={`flex flex-col items-center justify-center gap-5 p-8 text-center ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="relative flex h-24 w-24 items-center justify-center">
        <div className={`absolute inset-0 rounded-full border-[3px] animate-spin ${ring}`} aria-hidden />
        <div className={`relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl ${panel}`}>
          {resolved ? (
            <img src={resolved} alt="" className="h-full w-full object-contain p-1.5" />
          ) : (
            <GraduationCap className={`h-9 w-9 ${cap}`} aria-hidden />
          )}
        </div>
      </div>
      <p className={`max-w-xs text-sm font-medium ${caption}`}>{label}</p>
    </div>
  );
}

type BrandedLoadingScreenProps = BrandedLoadingProps & {
  /** Extra classes on the full-screen wrapper. */
  screenClassName?: string;
};

export function BrandedLoadingScreen({ logoUrl, label, tone = 'default', screenClassName = '' }: BrandedLoadingScreenProps) {
  const bg =
    tone === 'dark'
      ? 'bg-gradient-to-b from-slate-950 to-indigo-950'
      : 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40';
  return (
    <div className={`min-h-screen flex items-center justify-center ${bg} ${screenClassName}`}>
      <BrandedLoading logoUrl={logoUrl} label={label} tone={tone} />
    </div>
  );
}
