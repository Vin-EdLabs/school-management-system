import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Lock, LogOut, RefreshCw, ArrowLeft,
} from 'lucide-react';
import {
  PartnerApiError, getPartnerToken, partnerApi, setPartnerToken,
  parsePartnerLoginPrefillFromHash, clearPartnerLoginPrefillHash,
  readPartnerLoginCredentials, savePartnerLoginCredentials,
} from '@/services/partnerApi';
import { persistPartnerLogin } from './partnerPasswordUtils';
import PartnerForgotPassword from './PartnerForgotPassword';
import PartnerResetPassword from './PartnerResetPassword';
import PartnerOpenRedirect from './PartnerOpenRedirect';
import PartnerDashboard from './PartnerDashboard';
import PartnerSchools from './PartnerSchools';
import PartnerCommissions from './PartnerCommissions';
import PartnerTraining from './PartnerTraining';
import PartnerProfilePage from './PartnerProfile';
import PartnerMore from './PartnerMore';
import { PartnerShell } from './PartnerShell';
import PartnerLogo from './PartnerLogo';
import { PartnerLoadingScreen } from './PartnerLoading';
import { usePartnerPushSync, ensurePartnerPushSubscription } from './usePartnerPush';
import { usePartnerLiveSync } from './usePartnerLiveSync';
import {
  PartnerSessionContextProvider,
  clearPartnerSessionCache,
  usePartnerSession,
  usePartnerSessionState,
  type PartnerSession,
} from './partnerSession';
import PartnerSuspendedScreen from './PartnerSuspendedScreen';
import './partners.css';
import { getPartnersLandingUrl } from '@/utils/partnersHost';

const LOGIN_GRADIENT = 'linear-gradient(140deg, #050816 0%, #111a2f 38%, #085041 72%, #0d9e75 100%)';
const BRAND_PRIMARY = '#085041';
const BRAND_SECONDARY = '#0d9e75';

function PartnerLogin({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredBanner, setRegisteredBanner] = useState(false);

  useEffect(() => {
    const wasRegistered = window.location.hash.includes('registered=1');
    const fromHash = parsePartnerLoginPrefillFromHash();
    if (fromHash) {
      setIdentifier(fromHash.identifier);
      setPassword(fromHash.password);
      savePartnerLoginCredentials(fromHash.identifier, fromHash.password);
      clearPartnerLoginPrefillHash();
      setRegisteredBanner(wasRegistered);
      return;
    }
    const saved = readPartnerLoginCredentials();
    if (saved) {
      setIdentifier(saved.identifier);
      setPassword(saved.password);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!identifier.trim() || !password) {
      setError('Enter your email/phone and password');
      return;
    }
    setLoading(true);
    try {
      const result = await partnerApi.postPublic<{ token: string }>('/partners/login', {
        identifier: identifier.trim(),
        password,
      });
      setPartnerToken(result.token);
      await persistPartnerLogin(identifier.trim(), password);
      clearPartnerSessionCache();
      void ensurePartnerPushSubscription().catch(() => undefined);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : 'Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4" style={{ background: LOGIN_GRADIENT }}>
      <img
        src="/partners/scholarnerve-partner-emblem.png"
        alt=""
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[42%] w-[min(360px,75vw)] -translate-x-1/2 -translate-y-1/2 opacity-[0.07] blur-[0.5px]"
      />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-5%,rgba(13,158,117,0.2),transparent_58%)]" aria-hidden />
      <a
        href={getPartnersLandingUrl()}
        className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold text-emerald-100 backdrop-blur-sm transition hover:bg-white/15 sm:left-6 sm:top-6 sm:text-sm"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to Partner site
      </a>

      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-white/25 bg-white p-2 shadow-xl shadow-emerald-900/40 sm:h-28 sm:w-28">
            <PartnerLogo variant="compact" className="h-full w-full" />
          </div>
          <h1 className="text-2xl font-bold text-white">ScholarNerve Partners</h1>
          <p className="mt-1 text-sm font-medium text-emerald-200">Partner Portal</p>
          <p className="mt-3 text-sm text-slate-400">Sign in with your partner email or phone</p>
          {registeredBanner ? (
            <p className="mt-2 rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-medium text-emerald-100">
              Account created! Sign in below — your details are saved on this device.
            </p>
          ) : null}
        </div>

        <div className="relative rounded-2xl border border-white/20 bg-white/10 p-6 shadow-2xl backdrop-blur-lg">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate autoComplete="on">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Email or phone</label>
              <input
                type="text"
                name="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@example.com or 024 123 4567"
                autoComplete="username"
                className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-sm text-white placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-200">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 pr-10 text-sm text-white placeholder-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 flex items-center justify-between gap-2 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Forgot password?
                </span>
                <Link to="/forgot-password" className="font-semibold text-emerald-300 hover:text-emerald-200">
                  Reset via email
                </Link>
              </p>
            </div>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: `linear-gradient(90deg, ${BRAND_PRIMARY}, ${BRAND_SECONDARY})` }}
            >
              {loading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Signing in…</>
              ) : (
                <><LogOut className="h-4 w-4 rotate-180" /> Sign In</>
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-300">
            Don&apos;t have an account?{' '}
            <a
              href={getPartnersLandingUrl({ apply: true })}
              className="font-bold text-emerald-300 underline-offset-2 hover:text-emerald-200 hover:underline"
            >
              Create one
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function SessionErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="sn-partner-portal flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8FAFC] px-6 dark:bg-slate-950">
      <p className="max-w-sm text-center text-sm font-medium text-slate-600 dark:text-slate-300">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}

function PortalShell() {
  const [referOpen, setReferOpen] = useState(false);
  const { refresh } = usePartnerSession();
  usePartnerPushSync(true);
  usePartnerLiveSync(refresh, true);

  return (
    <PartnerShell referOpen={referOpen} onReferOpenChange={setReferOpen}>
      <Routes>
        <Route path="/" element={<PartnerDashboard />} />
        <Route path="/schools" element={<PartnerSchools />} />
        <Route path="/commissions" element={<PartnerCommissions />} />
        <Route path="/more" element={<PartnerMore />} />
        <Route path="/training" element={<PartnerTraining />} />
        <Route path="/profile" element={<PartnerProfilePage />} />
        <Route path="/open" element={<PartnerOpenRedirect />} />
        <Route path="*" element={<PartnerDashboard />} />
      </Routes>
    </PartnerShell>
  );
}

export default function PartnerPortalApp() {
  const navigate = useNavigate();
  const {
    checking,
    partner,
    stats,
    recentActivity,
    sessionError,
    loadSession,
    setChecking,
    markNotificationsRead,
    markNotificationRead,
    resetSession,
  } = usePartnerSessionState();

  useEffect(() => {
    document.title = 'ScholarNerve Partners';
  }, []);

  const logout = useCallback(() => {
    void partnerApi.post('/partners/logout').catch(() => undefined);
    setPartnerToken(null);
    resetSession();
    navigate('/', { replace: true });
  }, [navigate, resetSession]);

  const refresh = useCallback(async () => {
    await loadSession({ silent: true });
  }, [loadSession]);

  const session = useMemo<PartnerSession | null>(() => {
    if (!partner || !stats) return null;
    return {
      partner, stats, recentActivity, refresh, markNotificationsRead, markNotificationRead, logout,
    };
  }, [partner, stats, recentActivity, refresh, markNotificationsRead, markNotificationRead, logout]);

  if (checking) {
    return <PartnerLoadingScreen />;
  }

  if (sessionError && getPartnerToken()) {
    return (
      <SessionErrorScreen
        message={sessionError}
        onRetry={() => {
          setChecking(true);
          void loadSession();
        }}
      />
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/open" element={<PartnerOpenRedirect />} />
        <Route path="/forgot-password" element={<PartnerForgotPassword />} />
        <Route path="/reset-password" element={<PartnerResetPassword />} />
        <Route
          path="/login"
          element={
            <PartnerLogin
              onLoggedIn={() => {
                setChecking(true);
                void loadSession();
              }}
            />
          }
        />
        <Route
          path="*"
          element={
            <PartnerLogin
              onLoggedIn={() => {
                setChecking(true);
                void loadSession();
              }}
            />
          }
        />
      </Routes>
    );
  }

  if (session.partner.status === 'suspended') {
    return (
      <PartnerSessionContextProvider value={session}>
        <PartnerSuspendedScreen />
      </PartnerSessionContextProvider>
    );
  }

  return (
    <PartnerSessionContextProvider value={session}>
      <PortalShell />
    </PartnerSessionContextProvider>
  );
}
