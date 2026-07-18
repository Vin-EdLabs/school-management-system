import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, Phone } from 'lucide-react';
import { PartnerApiError, partnerApi } from '@/services/partnerApi';
import PartnerLogo from './PartnerLogo';
import { getPartnersLandingUrl } from '@/utils/partnersHost';

const LOGIN_GRADIENT = 'linear-gradient(140deg, #050816 0%, #111a2f 38%, #085041 72%, #0d9e75 100%)';

function MaskedEmailChip({ email }: { email: string }) {
  return (
    <span className="mt-3 inline-flex max-w-full items-center rounded-xl border border-emerald-400/30 bg-emerald-950/40 px-3 py-2 font-mono text-sm font-semibold tracking-wide text-emerald-50">
      {email}
    </span>
  );
}

function isValidPartnerPhone(input: string): boolean {
  if (input.includes('@')) return false;
  return input.replace(/\D/g, '').length >= 9;
}

export default function PartnerForgotPassword() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = phone.trim();
    if (!trimmed) {
      setError('Enter the phone number on your partner account');
      return;
    }
    if (trimmed.includes('@')) {
      setError('Enter your phone number only — not your email');
      return;
    }
    if (!isValidPartnerPhone(trimmed)) {
      setError('Enter a valid phone number (at least 9 digits)');
      return;
    }
    setLoading(true);
    try {
      const result = await partnerApi.postPublic<{ maskedEmail?: string | null; message?: string }>(
        '/partners/forgot-password',
        { phone: trimmed },
      );
      setMaskedEmail(result.maskedEmail || null);
      setSent(true);
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4" style={{ background: LOGIN_GRADIENT }}>
      <a
        href={getPartnersLandingUrl()}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-100 backdrop-blur-sm sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Partner site
      </a>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/25 bg-white p-2 shadow-xl">
            <PartnerLogo variant="compact" className="h-full w-full" />
          </div>
          <h1 className="text-2xl font-bold text-white">Forgot password</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your phone number — we&apos;ll send the reset link to the email on your account
          </p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg">
          {sent ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-200">
                <Mail className="h-6 w-6" />
              </div>
              {maskedEmail ? (
                <>
                  <p className="text-sm leading-relaxed text-emerald-100">
                    Reset link sent to:
                  </p>
                  <MaskedEmailChip email={maskedEmail} />
                  <p className="text-xs leading-relaxed text-slate-400">
                    Check that inbox and spam folder. The link expires in 1 hour.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-emerald-100">
                  If an account exists with that phone number, we sent a reset link to the email on
                  your partner account. Check your inbox and spam folder.
                </p>
              )}
              <Link to="/login" className="inline-block text-sm font-bold text-emerald-300 hover:text-emerald-200">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Phone number</label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="024 123 4567"
                    autoComplete="tel"
                    className="w-full rounded-lg border border-white/20 bg-white/10 py-3 pl-10 pr-4 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  Use the same number you registered with. The reset link goes to your account email — we&apos;ll show you which one.
                </p>
              </div>
              {error ? (
                <div className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">{error}</div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending…</> : 'Send reset link'}
              </button>
              <p className="text-center text-sm text-slate-300">
                <Link to="/login" className="font-semibold text-emerald-300 hover:text-emerald-200">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
