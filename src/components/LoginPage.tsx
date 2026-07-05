import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { fetchTenantById, resolveLogoUrl } from '../services/tenantService';
import { useSchool } from '../contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, Eye, EyeOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { BrandedLoading, BrandedLoadingScreen } from '@/components/common/BrandedLoading';
import { toast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getFriendlyLoginMessage, getFriendlyLoginTitle } from '../utils/loginErrors';

const LoginPage = () => {
  const { schoolId } = useParams<{ schoolId?: string }>();
  const { schoolId: contextSchoolId } = useSchool();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [timeoutNotice, setTimeoutNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenant, setTenant] = useState<{
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null>(null);
  const [tenantBrandingLoading, setTenantBrandingLoading] = useState(
    !!(contextSchoolId ?? (schoolId ? parseInt(schoolId, 10) : undefined))
  );
  const { login } = useAuth();

  const tenantId = contextSchoolId ?? (schoolId ? parseInt(schoolId, 10) : undefined);

  useEffect(() => {
    if (!tenantId) {
      setTenant(null);
      setTenantBrandingLoading(false);
      return;
    }
    setTenantBrandingLoading(true);
    fetchTenantById(tenantId)
      .then((t) => {
        if (t) {
          setTenant({
            name: t.name,
            logo_url: t.logo_url,
            primary_color: t.primary_color,
            secondary_color: t.secondary_color,
          });
        } else {
          setTenant(null);
        }
      })
      .finally(() => setTenantBrandingLoading(false));
  }, [tenantId]);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'session_timeout') {
        setTimeoutNotice('Your session expired due to inactivity. Please sign in again.');
      }
    } catch {
      // ignore
    }
  }, []);

  const primaryColor = tenant?.primary_color || '#2563eb';
  const secondaryColor = tenant?.secondary_color || '#7c3aed';
  const brandPrimary = tenant?.primary_color || '#7c3aed';
  const brandSecondary = tenant?.secondary_color || '#db2777';
  const schoolName = tenant?.name || 'School';
  const logoUrl = resolveLogoUrl(tenant?.logo_url || null);
  const premiumLoginGradient = `linear-gradient(140deg, #050816 0%, #111a2f 38%, ${brandPrimary} 72%, ${brandSecondary} 100%)`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      if (tenantId == null || Number.isNaN(tenantId)) {
        const msg =
          'This page is missing a valid school. Open the portal using your school link (or pick your school from the home page).';
        setFormError(msg);
        toast({ title: 'School not found', description: msg, variant: 'destructive' });
        return;
      }
      const success = await login(username, password, 'administrator', tenantId);
      if (success) {
        toast({
          title: 'Login Successful',
          description: `Welcome to ${schoolName} Management System`,
        });
      }
    } catch (error: unknown) {
      const friendly = getFriendlyLoginMessage(error);
      setFormError(friendly);
      toast({
        title: getFriendlyLoginTitle(error),
        description: friendly,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tenantBrandingLoading && tenantId) {
    return <BrandedLoadingScreen logoUrl={tenant?.logo_url ?? undefined} label="Loading school…" />;
  }

  return (
    <>
      {/* ── Phone: parent-portal-style staff login ── */}
      <div
        className="md:hidden min-h-screen flex items-center justify-center p-4"
        style={{ background: premiumLoginGradient }}
      >
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {logoUrl ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 border border-white/20 flex items-center justify-center shadow-xl shadow-purple-900/40">
                  <img
                    src={logoUrl}
                    alt={schoolName}
                    className="w-full h-full object-contain p-1"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{schoolName}</h1>
                  <p className="text-purple-200 text-sm font-medium mt-0.5">Staff Portal</p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl"
                  style={{
                    background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary})`,
                    boxShadow: `0 20px 40px ${brandPrimary}40`,
                  }}
                >
                  <GraduationCap className="w-9 h-9 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white">{schoolName}</h1>
                <p className="text-purple-200 text-sm font-medium mt-1">Staff Portal</p>
              </>
            )}
            <p className="text-slate-400 text-sm mt-3">Sign in with your username and password</p>
          </div>

          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-6 shadow-2xl relative">
            {isSubmitting ? (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-slate-950/40 backdrop-blur-[2px]">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Signing in…
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              {timeoutNotice ? (
                <div className="bg-amber-500/15 border border-amber-400/30 text-amber-100 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {timeoutNotice}
                </div>
              ) : null}

              <div>
                <label htmlFor="username-mobile" className="block text-sm font-medium text-slate-200 mb-1.5">
                  Username
                </label>
                <input
                  id="username-mobile"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                  required
                  autoComplete="username"
                />
              </div>

              <div>
                <label htmlFor="password-mobile" className="block text-sm font-medium text-slate-200 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password-mobile"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-lg px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  For administrators, teachers, and school staff
                </p>
              </div>

              {formError ? (
                <div className="bg-red-500/20 border border-red-400/30 text-red-200 rounded-lg px-4 py-3 text-sm flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {formError}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full text-white font-semibold rounded-lg py-3 text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(90deg, ${brandPrimary}, ${brandSecondary})` }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>

          <div className="mt-8 pb-6 flex flex-col items-center gap-2.5">
            <div
              className="h-px w-20"
              style={{
                background: `linear-gradient(90deg, transparent, ${brandPrimary}99, ${brandSecondary}99, transparent)`,
              }}
            />
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 backdrop-blur-sm shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
              <p className="text-center text-xs text-slate-300/90">
                <span className="font-medium tracking-wide">Powered by</span>{' '}
                <span className="font-black tracking-tight text-emerald-300">
                  ScholarNerve
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Laptop / desktop: original split login ── */}
      <div
        className="hidden md:flex fixed inset-0 z-[100] items-center justify-center overflow-auto p-3 md:p-6"
        style={{
          background: `radial-gradient(circle at 18% 12%, ${primaryColor}30 0, transparent 32%), radial-gradient(circle at 82% 82%, ${secondaryColor}2e 0, transparent 34%), linear-gradient(135deg, #020617 0%, #0f172a 42%, #111827 100%)`,
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:42px_42px]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 select-none text-[16vw] font-black italic tracking-[-0.12em] text-white/5 md:block">
          ScholarNerve
        </div>
        <div className="relative flex min-h-screen w-full items-center justify-center [zoom:0.8]">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/15 bg-white/95 shadow-[0_30px_100px_rgba(0,0,0,0.45)] backdrop-blur-xl md:rounded-[2rem]">
            <div className="pointer-events-none absolute -right-16 -top-24 z-0 text-[8rem] font-black italic leading-none tracking-[-0.08em] text-slate-900/[0.035] md:text-[11rem]">
              ScholarNerve
            </div>
            {isSubmitting && (
              <div className="absolute inset-0 z-[120] flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-[2px] md:rounded-3xl">
                <BrandedLoading logoUrl={tenant?.logo_url ?? null} label="Signing you in…" className="py-4" />
              </div>
            )}
            <div className="relative z-10 grid min-h-[560px] grid-cols-1 md:min-h-[620px] md:grid-cols-2">
              <div
                className="order-1 relative flex items-center justify-center overflow-hidden p-5 md:order-1 md:p-12"
                style={{
                  background: `linear-gradient(145deg, ${primaryColor}16 0%, #f8faff 45%, ${secondaryColor}14 100%)`,
                }}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.18),transparent_42%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(236,72,153,0.14),transparent_45%)]" />
                <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center text-center">
                  {tenant?.logo_url ? (
                    <div className="relative">
                      <div
                        className="absolute inset-0 rounded-[2rem] blur-2xl"
                        style={{ background: `${primaryColor}2a` }}
                      />
                      <div className="relative flex h-40 w-40 items-center justify-center rounded-[2.25rem] border border-white/80 bg-white/90 p-4 shadow-2xl ring-8 ring-white/30 md:h-72 md:w-72 md:p-8">
                        <img
                          src={logoUrl}
                          alt={schoolName}
                          className="max-h-full max-w-full object-contain drop-shadow-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 w-40 items-center justify-center rounded-[2.25rem] border border-white/80 bg-white/90 shadow-2xl ring-8 ring-white/30 md:h-72 md:w-72">
                      <GraduationCap className="h-14 w-14 text-slate-500 md:h-24 md:w-24" />
                    </div>
                  )}
                  <h2 className="mt-5 text-2xl font-black uppercase tracking-tight text-slate-950 md:mt-7 md:text-3xl">
                    {schoolName}
                  </h2>
                  <p className="mt-2 max-w-xs text-sm font-medium leading-relaxed text-slate-500">
                    A polished workspace for records, finance, teaching, and school operations.
                  </p>
                </div>
              </div>

              <div className="order-2 flex items-center justify-center bg-white/95 p-6 md:order-2 md:p-12">
                <div className="relative w-full max-w-sm">
                  <div className="mb-6 md:mb-8">
                    <h1 className="text-[38px] leading-tight font-black text-slate-950 md:text-4xl">Welcome back</h1>
                    <p className="mt-3 text-sm leading-relaxed text-slate-500">
                      Enter your admin credentials to access the main system.
                    </p>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                    {timeoutNotice && (
                      <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-semibold">Session timed out</AlertTitle>
                        <AlertDescription className="text-sm opacity-95">{timeoutNotice}</AlertDescription>
                      </Alert>
                    )}
                    {formError && (
                      <Alert
                        variant="destructive"
                        className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
                      >
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle className="text-sm font-semibold">Could not sign you in</AlertTitle>
                        <AlertDescription className="text-sm opacity-95">{formError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Username
                      </Label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/80 pl-11 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-200"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Password
                      </Label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="h-12 rounded-xl border-slate-200 bg-slate-50/80 pl-11 pr-11 text-slate-900 shadow-sm placeholder:text-slate-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-200"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
                      style={{ background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                    >
                      Login
                    </Button>
                  </form>
                  <p className="mt-8 text-center font-serif text-sm font-semibold italic tracking-wide text-slate-500">
                    Powered by Scholarnerve
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;
