import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchTenantById, resolveLogoUrl } from '../services/tenantService';
import { useSchool } from '../contexts/SchoolContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useAuth } from '../contexts/AuthContext';
import { GraduationCap, Lock, User, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { BrandedLoading, BrandedLoadingScreen } from '@/components/common/BrandedLoading';
import { toast } from '@/hooks/use-toast';
import PwaInstallButton from './common/PwaInstallButton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { getFriendlyLoginMessage, getFriendlyLoginTitle } from '../utils/loginErrors';

const LoginPage = () => {
  const { schoolId } = useParams<{ schoolId?: string }>();
  const { schoolId: contextSchoolId } = useSchool();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenant, setTenant] = useState<{ name: string; logo_url: string | null; primary_color: string | null; secondary_color: string | null } | null>(null);
  const [tenantBrandingLoading, setTenantBrandingLoading] = useState(!!(contextSchoolId ?? (schoolId ? parseInt(schoolId, 10) : undefined)));
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
        if (t) setTenant({ name: t.name, logo_url: t.logo_url, primary_color: t.primary_color, secondary_color: t.secondary_color });
        else setTenant(null);
      })
      .finally(() => setTenantBrandingLoading(false));
  }, [tenantId]);

  const primaryColor = tenant?.primary_color || '#2563eb';
  const secondaryColor = tenant?.secondary_color || '#7c3aed';
  const schoolName = tenant?.name || 'School';
  const logoUrl = resolveLogoUrl(tenant?.logo_url || null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      if (tenantId == null || Number.isNaN(tenantId)) {
        const msg = 'This page is missing a valid school. Open the portal using your school link (or pick your school from the home page).';
        setFormError(msg);
        toast({ title: 'School not found', description: msg, variant: 'destructive' });
        return;
      }
      const success = await login(username, password, 'administrator', tenantId);
      if (success) {
        toast({
          title: "Login Successful",
          description: `Welcome to ${schoolName} Management System`,
        });
      }
    } catch (error: unknown) {
      const friendly = getFriendlyLoginMessage(error);
      setFormError(friendly);
      toast({
        title: getFriendlyLoginTitle(error),
        description: friendly,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (tenantBrandingLoading && tenantId) {
    return <BrandedLoadingScreen logoUrl={tenant?.logo_url ?? undefined} label="Loading school…" />;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-auto bg-slate-100 p-3 md:p-4">
      <div className="absolute right-4 top-4 z-[110]">
        <PwaInstallButton
          variant="outline"
          size="icon"
          logoUrl={logoUrl}
          className="h-10 w-10 rounded-xl border-slate-200 bg-white/95 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50"
        />
      </div>
      <div className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl md:rounded-3xl">
        {isSubmitting && (
          <div className="absolute inset-0 z-[120] flex items-center justify-center rounded-2xl bg-white/85 backdrop-blur-[2px] md:rounded-3xl">
            <BrandedLoading logoUrl={tenant?.logo_url ?? null} label="Signing you in…" className="py-4" />
          </div>
        )}
        <div className="grid min-h-[560px] grid-cols-1 md:min-h-[620px] md:grid-cols-2">
          {/* Left: School branding / logo */}
          <div
            className="order-1 relative flex items-center justify-center p-4 md:order-1 md:p-12"
            style={{ background: `linear-gradient(145deg, #eef3ff 0%, #f8faff 45%, #edf6ff 100%)` }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(99,102,241,0.12),transparent_42%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_90%,rgba(236,72,153,0.10),transparent_45%)]" />
            <div className="relative z-10 flex w-full max-w-md flex-col items-center justify-center text-center">
              {tenant?.logo_url ? (
                <img
                  src={logoUrl}
                  alt={schoolName}
                  className="h-14 w-14 rounded-full object-contain border border-white/70 bg-white/80 p-1 shadow md:h-64 md:w-64 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/80 border border-white/70 shadow md:h-64 md:w-64 md:border-0 md:bg-white/70 md:shadow-none">
                  <GraduationCap className="h-6 w-6 text-slate-500 md:h-16 md:w-16" />
                </div>
              )}
              <h2 className="mt-3 text-xl font-black uppercase tracking-tight text-slate-900 md:mt-6 md:text-2xl">{schoolName}</h2>
              <p className="mt-1 text-xs font-medium text-slate-500 md:mt-2 md:text-sm">School Management System</p>
            </div>
          </div>

          {/* Right: Login form */}
          <div className="order-2 flex items-center justify-center bg-white p-6 md:order-2 md:p-12">
            <div className="w-full max-w-sm">
              <div className="mb-6 md:mb-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 md:text-sm md:tracking-[0.2em]">Tenant Portal</p>
                <h1 className="mt-1 text-[38px] leading-tight font-black text-slate-900 md:mt-2 md:text-3xl">Login to your account</h1>
                <p className="mt-2 text-sm text-slate-500">Enter your admin credentials to access the main system.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
                {formError && (
                  <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
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
                      className="h-12 rounded-xl border-slate-200 pl-11 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-200"
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
                      className="h-12 rounded-xl border-slate-200 pl-11 pr-11 text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-200"
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
                  className="h-12 w-full rounded-xl text-base font-semibold text-white shadow-lg"
                  style={{ background: `linear-gradient(120deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                >
                  Login
                </Button>
              </form>

              <button
                onClick={() => navigate('/')}
                className="mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 transition-colors hover:text-slate-800 md:mt-6 md:text-xs"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to site
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-1 left-0 right-0 text-center md:bottom-5">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-slate-300 md:text-[10px] md:tracking-[0.35em]">Powered by Scholarnerve</p>
      </div>
    </div>
  );
};

export default LoginPage;
