import { Ban, LogOut, Mail, Phone } from 'lucide-react';
import {
  SCHOLARNERVE_SUPPORT_EMAIL,
  SCHOLARNERVE_SUPPORT_PHONE,
  SCHOLARNERVE_SUPPORT_PHONE_TEL,
  SCHOLARNERVE_SUPPORT_WHATSAPP,
  SCHOLARNERVE_SUPPORT_WHATSAPP_URL,
} from '@/constants/scholarNerveSupport';
import PartnerLogo from './PartnerLogo';
import { usePartnerSession } from './partnerSession';
import './partners.css';

export default function PartnerSuspendedScreen() {
  const { partner, logout } = usePartnerSession();

  return (
    <div className="sn-partner-portal relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-6">
      <img
        src="/partners/scholarnerve-partner-emblem.png"
        alt=""
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[38%] w-[min(340px,72vw)] -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
      />
      <div className="snp-portal-bg pointer-events-none fixed inset-0 opacity-60" aria-hidden />

      <div className="relative z-10 w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-xl ring-1 ring-red-100 dark:bg-slate-900 dark:ring-red-900/40">
          <PartnerLogo variant="compact" className="h-full w-full opacity-40 grayscale" />
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-red-300/60 bg-red-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <Ban className="h-3.5 w-3.5" />
          Account suspended
        </div>

        <h1 className="mt-5 text-2xl font-black text-slate-900 dark:text-white">
          Access locked
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Hi {partner.firstName}, your ScholarNerve Partner account is currently suspended.
          Referrals, training, commissions, and payouts are unavailable until your account is restored.
        </p>

        {partner.suspensionNote ? (
          <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-left dark:border-red-900/50 dark:bg-red-950/30">
            <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 dark:text-red-400">Reason</p>
            <p className="mt-1 text-sm text-red-900 dark:text-red-200">{partner.suspensionNote}</p>
          </div>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-left backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Contact ScholarNerve</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Reach our team to resolve this suspension or ask questions about your account.
          </p>
          <div className="mt-3 space-y-2 text-sm font-medium">
            <a
              href={`mailto:${SCHOLARNERVE_SUPPORT_EMAIL}`}
              className="flex items-center gap-2 text-emerald-800 transition hover:text-emerald-600 dark:text-emerald-300"
            >
              <Mail className="h-3.5 w-3.5 shrink-0" />
              {SCHOLARNERVE_SUPPORT_EMAIL}
            </a>
            <a
              href={SCHOLARNERVE_SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-emerald-800 transition hover:text-emerald-600 dark:text-emerald-300"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              WhatsApp: {SCHOLARNERVE_SUPPORT_WHATSAPP}
            </a>
            <a
              href={`tel:${SCHOLARNERVE_SUPPORT_PHONE_TEL}`}
              className="flex items-center gap-2 text-emerald-800 transition hover:text-emerald-600 dark:text-emerald-300"
            >
              <Phone className="h-3.5 w-3.5 shrink-0" />
              Call: {SCHOLARNERVE_SUPPORT_PHONE}
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
