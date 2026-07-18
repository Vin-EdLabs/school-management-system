import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { PartnerApiError, partnerApi } from '@/services/partnerApi';
import PartnerLogo from './PartnerLogo';
import { PARTNER_MIN_PASSWORD, persistPartnerLogin, suggestPartnerPassword } from './partnerPasswordUtils';
import { getPartnersLandingUrl } from '@/utils/partnersHost';

const LOGIN_GRADIENT = 'linear-gradient(140deg, #050816 0%, #111a2f 38%, #085041 72%, #0d9e75 100%)';

function MaskedEmailChip({ email }: { email: string }) {
  return (
    <span className="mt-1 inline-flex max-w-full items-center rounded-lg border border-emerald-400/25 bg-emerald-950/30 px-2.5 py-1.5 font-mono text-sm font-semibold tracking-wide text-emerald-50">
      {email}
    </span>
  );
}

export default function PartnerResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => searchParams.get('token') || '', [searchParams]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');
  const [firstName, setFirstName] = useState('');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setPreviewLoading(true);
    void partnerApi
      .getPublic<{ maskedEmail: string; firstName?: string }>(
        `/partners/reset-password/preview?token=${encodeURIComponent(token)}`,
      )
      .then((result) => {
        if (cancelled) return;
        setMaskedEmail(result.maskedEmail || '');
        setFirstName(result.firstName || '');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof PartnerApiError ? err.message : 'This reset link is invalid or has expired');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const suggest = () => {
    const pw = suggestPartnerPassword();
    setPassword(pw);
    setConfirm(pw);
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!token || !maskedEmail) {
      setError('Invalid reset link. Request a new one from the login page.');
      return;
    }
    if (password.length < PARTNER_MIN_PASSWORD) {
      setError(`Password must be at least ${PARTNER_MIN_PASSWORD} characters`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const result = await partnerApi.postPublic<{ email: string; maskedEmail?: string }>(
        '/partners/reset-password',
        { token, newPassword: password },
      );
      if (result.maskedEmail) setMaskedEmail(result.maskedEmail);
      if (result.email) await persistPartnerLogin(result.email, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 2400);
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center" style={{ background: LOGIN_GRADIENT }}>
        <p className="max-w-sm text-sm text-slate-300">This reset link is invalid. Request a new one from the login page.</p>
        <Link to="/forgot-password" className="font-bold text-emerald-300">Request reset link</Link>
      </div>
    );
  }

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
          <h1 className="text-2xl font-bold text-white">Choose a new password</h1>
          <p className="mt-2 text-sm text-slate-400">Min. {PARTNER_MIN_PASSWORD} characters</p>
        </div>

        <div className="rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg">
          {previewLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-300" />
            </div>
          ) : done ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
              <p className="text-sm text-emerald-100">
                Password updated{maskedEmail ? ' for' : ''}{' '}
                {maskedEmail ? <MaskedEmailChip email={maskedEmail} /> : ' successfully'}.
              </p>
              <p className="text-xs text-slate-400">Redirecting to sign in…</p>
            </div>
          ) : maskedEmail ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="on">
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-left">
                <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-200/90">Partner account</p>
                {firstName ? (
                  <p className="mt-1 text-sm font-semibold text-white">{firstName}</p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-emerald-100/90">Reset link sent to</p>
                <MaskedEmailChip email={maskedEmail} />
                <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
                  Your new password will apply to this account only.
                </p>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-200">New password</label>
                  <button type="button" onClick={suggest} className="text-xs font-bold text-emerald-300 hover:text-emerald-200">
                    Suggest password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 pr-10 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-200">Confirm password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              {error ? (
                <div className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">{error}</div>
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-800 to-emerald-500 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : 'Update password'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="text-sm text-red-200">{error || 'This reset link is invalid or has expired.'}</p>
              <Link to="/forgot-password" className="inline-block text-sm font-bold text-emerald-300 hover:text-emerald-200">
                Request a new reset link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
