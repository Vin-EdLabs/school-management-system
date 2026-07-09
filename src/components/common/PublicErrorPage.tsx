import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Home, Mail, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { detectTenantSlugFromHost } from '../../utils/tenantHost';

export const SCHOLARNERVE_SUPPORT_EMAIL = 'scholarnerve@gmail.com';

export type PublicErrorVariant = 'default' | 'deactivated' | 'not-found';

export function getScholarNerveLandingUrl(): string {
  return detectTenantSlugFromHost() ? 'https://scholarnerve.com/' : '/';
}

type PublicErrorPageProps = {
  variant?: PublicErrorVariant;
  eyebrow: string;
  title: string;
  description: string;
  detail?: string | null;
  schoolName?: string | null;
  icon: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  showLandingLink?: boolean;
};

export function PublicErrorPage({
  variant = 'default',
  eyebrow,
  title,
  description,
  detail,
  schoolName,
  icon,
  onRetry,
  retryLabel = 'Try again',
  showLandingLink = true,
}: PublicErrorPageProps) {
  const homeHref = getScholarNerveLandingUrl();
  const onApex = homeHref === '/';
  const isDeactivated = variant === 'deactivated';

  return (
    <div className="scholar-landing scholar-public-error-page flex h-screen flex-col overflow-hidden bg-[#f4faf7] text-[#0a1410]">
      <header className="shrink-0 border-b border-emerald-200/80 bg-white">
        <div className="mx-auto flex h-10 max-w-md items-center px-3">
          {onApex ? (
            <Link to="/" className="flex items-center gap-2 text-[#0a1410]" aria-label="ScholarNerve home">
              <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-emerald-100">
                <img src="/android-chrome-192x192.png" alt="ScholarNerve" className="h-full w-full object-cover" />
              </span>
              <span className="scholar-display text-xs font-bold">ScholarNerve</span>
            </Link>
          ) : (
            <a href={homeHref} className="flex items-center gap-2 text-[#0a1410]" aria-label="ScholarNerve home">
              <span className="flex h-6 w-6 shrink-0 overflow-hidden rounded-md bg-white ring-1 ring-emerald-100">
                <img src="/android-chrome-192x192.png" alt="ScholarNerve" className="h-full w-full object-cover" />
              </span>
              <span className="scholar-display text-xs font-bold">ScholarNerve</span>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-3 py-3">
        <div className="rounded-xl border border-emerald-200 border-t-[3px] border-t-emerald-500 bg-white p-3 shadow-sm shadow-slate-900/5">
          <div className="flex items-start gap-2.5">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                isDeactivated ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              {icon}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  isDeactivated ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {eyebrow}
              </p>
              <h1 className="scholar-display mt-0.5 text-lg font-extrabold leading-tight text-[#0a1410]">{title}</h1>
              {schoolName ? (
                <p className="mt-0.5 text-[11px] font-semibold text-slate-800">{schoolName}</p>
              ) : null}
            </div>
          </div>

          <p className="mt-2.5 text-xs leading-4 text-slate-700">{description}</p>

          {detail ? (
            <p className="mt-2 break-all rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
              {detail}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {showLandingLink ? (
              onApex ? (
                <Button asChild variant="primaryAction" size="sm" className="h-7 rounded-md px-2.5 text-[11px]">
                  <Link to="/">
                    <Home className="mr-1.5 h-3.5 w-3.5" />
                    Landing page
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="primaryAction" size="sm" className="h-7 rounded-md px-2.5 text-[11px]">
                  <a href={homeHref}>
                    <Home className="mr-1.5 h-3.5 w-3.5" />
                    Landing page
                  </a>
                </Button>
              )
            ) : null}
            {onRetry ? (
              <Button
                type="button"
                variant={showLandingLink ? 'outline' : 'primaryAction'}
                size="sm"
                className={
                  showLandingLink
                    ? 'h-7 rounded-md border-slate-300 bg-white px-2.5 text-[11px] text-slate-800'
                    : 'h-7 rounded-md px-2.5 text-[11px]'
                }
                onClick={onRetry}
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                {retryLabel}
              </Button>
            ) : showLandingLink ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 rounded-md border-slate-300 bg-white px-2.5 text-[11px] text-slate-800"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Go back
              </Button>
            ) : null}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-2.5">
            <p className="text-[11px] font-semibold text-[#0a1410]">Need help?</p>
            <a
              href={`mailto:${SCHOLARNERVE_SUPPORT_EMAIL}`}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
            >
              <Mail className="h-3 w-3" />
              {SCHOLARNERVE_SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </main>

      <footer className="shrink-0 py-2 text-center text-[10px] text-slate-500">
        © {new Date().getFullYear()} ScholarNerve
      </footer>
    </div>
  );
}
