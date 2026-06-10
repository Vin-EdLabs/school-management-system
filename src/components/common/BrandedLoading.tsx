import React, { useCallback } from 'react';
import { GraduationCap, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { LOADING_TIMEOUT_MS, useLoadingTimeout } from '@/hooks/useLoadingTimeout';
import { cn } from '@/lib/utils';

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
  /** When false, loading finished — spinner and timeout reset. Default true. */
  active?: boolean;
  /** Spinner timeout before network fallback (ms). Default 9000. */
  timeoutMs?: number;
  /** Retry handler; defaults to full page reload. */
  onRetry?: () => void;
  /** Show connection fallback after timeout when network is constrained. Default true. */
  networkAware?: boolean;
};

function LoadingConnectionFallback({
  tone,
  onRetry,
  className,
}: {
  tone: 'default' | 'dark';
  onRetry: () => void;
  className?: string;
}) {
  const caption = tone === 'dark' ? 'text-purple-200/90' : 'text-slate-600 dark:text-slate-300';
  const panel = tone === 'dark' ? 'bg-white/10 ring-1 ring-white/15' : 'bg-white shadow-md ring-1 ring-slate-200/80 dark:bg-slate-900 dark:ring-slate-700';
  const iconWrap =
    tone === 'dark'
      ? 'bg-red-500/15 text-red-300'
      : 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400';

  return (
    <div
      className={cn('flex flex-col items-center justify-center gap-5 p-8 text-center', className)}
      role="alert"
      aria-live="polite"
    >
      <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', iconWrap)}>
        <WifiOff className="h-8 w-8" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1.5">
        <p className={cn('text-sm font-semibold text-foreground', tone === 'dark' && 'text-white')}>
          Unable to load
        </p>
        <p className={cn('text-sm', caption)}>
          Check your connection and try again.
        </p>
      </div>
      <Button
        type="button"
        variant={tone === 'dark' ? 'secondary' : 'outline'}
        size="sm"
        className={cn(panel, 'gap-2')}
        onClick={onRetry}
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </Button>
    </div>
  );
}

/**
 * Full-screen or card-style loading with optional school logo, smooth spinner,
 * and network-aware timeout fallback.
 */
export function BrandedLoading({
  logoUrl,
  label = 'Loading…',
  className = '',
  tone = 'default',
  active = true,
  timeoutMs = LOADING_TIMEOUT_MS,
  onRetry,
  networkAware = true,
}: BrandedLoadingProps) {
  const { isOnline, isLowData, isSlowResponse, retryPing } = useNetworkStatus({ enablePing: networkAware });
  const { timedOut, reset } = useLoadingTimeout(active, timeoutMs);

  const handleRetry = useCallback(() => {
    reset();
    retryPing();
    if (onRetry) {
      onRetry();
    } else if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [onRetry, reset, retryPing]);

  const networkConstrained = !isOnline || isLowData || isSlowResponse;
  const showFallback = networkAware && active && timedOut && networkConstrained;

  if (showFallback) {
    return <LoadingConnectionFallback tone={tone} onRetry={handleRetry} className={className} />;
  }

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

export function BrandedLoadingScreen({
  logoUrl,
  label,
  tone = 'default',
  screenClassName = '',
  active = true,
  timeoutMs,
  onRetry,
  networkAware,
}: BrandedLoadingScreenProps) {
  const bg =
    tone === 'dark'
      ? 'bg-gradient-to-b from-slate-950 to-indigo-950'
      : 'bg-gradient-to-br from-slate-50 via-white to-indigo-50/80 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950/40';
  return (
    <div className={`min-h-screen flex items-center justify-center ${bg} ${screenClassName}`}>
      <BrandedLoading
        logoUrl={logoUrl}
        label={label}
        tone={tone}
        active={active}
        timeoutMs={timeoutMs}
        onRetry={onRetry}
        networkAware={networkAware}
      />
    </div>
  );
}

export { LoadingConnectionFallback };
