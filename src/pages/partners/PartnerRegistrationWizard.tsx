import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, CheckCircle2, ChevronLeft, Eye, EyeOff, Loader2, MapPin, Target, User, Wallet,
} from 'lucide-react';
import {
  HEARD_FROM_OPTIONS, MOMO_NETWORKS, PartnerApiError, PARTNER_GENDERS, partnerApi,
  GHANA_REGIONS, buildPartnerLoginPrefillUrl, readPartnerLoginCredentials,
} from '@/services/partnerApi';
import RegionAutocomplete from './RegionAutocomplete';
import { PARTNER_MIN_PASSWORD, persistPartnerLogin, suggestPartnerPassword } from './partnerPasswordUtils';
import { prefillIdentifierFromSaved, useBrowserAutofillSync } from './useBrowserAutofillSync';
import './partners.css';

const SCHOOLS_REACH_OPTIONS = ['1-5', '6-15', '16-30', '30+'];

const STAGES = [
  { id: 1, title: 'About you', subtitle: 'Your name, gender, and contact number', icon: User },
  { id: 2, title: 'Your area', subtitle: 'Where you operate', icon: MapPin },
  { id: 3, title: 'Get paid', subtitle: 'MoMo for your commissions', icon: Wallet },
  { id: 4, title: 'Your goals', subtitle: 'How you plan to grow', icon: Target },
  { id: 5, title: 'Create account', subtitle: 'Email and password to sign in', icon: CheckCircle2 },
] as const;

type FormState = {
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  region: string;
  town: string;
  occupation: string;
  momoNumber: string;
  momoNetwork: string;
  schoolsTarget: string;
  heardFrom: string;
  motivation: string;
};

const EMPTY_FORM: FormState = {
  firstName: '', lastName: '', gender: '', phone: '', email: '', password: '', confirmPassword: '',
  region: '', town: '', occupation: '', momoNumber: '', momoNetwork: '', schoolsTarget: '',
  heardFrom: '', motivation: '',
};

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: '#c4353b' };
  if (score === 2) return { score, label: 'Fair', color: '#b7791f' };
  if (score === 3) return { score, label: 'Good', color: '#0D9E75' };
  return { score, label: 'Strong', color: '#085041' };
}

function validateStage(stageIndex: number, form: FormState): Partial<Record<keyof FormState, string>> {
  const next: Partial<Record<keyof FormState, string>> = {};
  switch (stageIndex) {
    case 0:
      if (!form.firstName.trim()) next.firstName = 'First name is required';
      if (!form.lastName.trim()) next.lastName = 'Last name is required';
      if (!form.gender) next.gender = 'Select Male or Female';
      if (form.phone.replace(/\D/g, '').length < 9) next.phone = 'Enter a valid phone / WhatsApp number';
      break;
    case 1:
      if (!form.region.trim()) next.region = 'Select your region';
      else if (!GHANA_REGIONS.includes(form.region)) next.region = 'Pick a region from the suggestions';
      if (!form.town.trim()) next.town = 'Enter your town or city';
      break;
    case 2:
      if (!form.momoNumber.trim()) next.momoNumber = 'MoMo number is required';
      if (!form.momoNetwork) next.momoNetwork = 'Select your MoMo network';
      break;
    case 3:
      if (!form.heardFrom) next.heardFrom = 'Tell us how you heard about the Partner Program';
      break;
    case 4:
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email address';
      if (form.password.length < PARTNER_MIN_PASSWORD) {
        next.password = `Password must be at least ${PARTNER_MIN_PASSWORD} characters`;
      }
      if (form.confirmPassword !== form.password) next.confirmPassword = 'Passwords do not match';
      break;
    default:
      break;
  }
  return next;
}

const fieldClass =
  'snp-wizard-input w-full rounded-[14px] border border-[var(--sn-border)] bg-white px-4 py-3.5 text-[15px] font-medium text-[var(--ink)] placeholder:font-normal placeholder:text-[var(--ink-subtle)] outline-none transition duration-200 focus:border-[var(--brand)] focus:shadow-[0_0_0_4px_var(--brand-glow)]';
const fieldErrorClass = 'border-red-400 focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(196,53,59,0.15)]';
const labelClass = 'mb-2 block text-[13px] font-bold tracking-wide text-[var(--ink)]';
const errorTextClass = 'mt-1.5 text-[12.5px] font-semibold text-red-600';

export default function PartnerRegistrationWizard() {
  const [stageIndex, setStageIndex] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const stage = STAGES[stageIndex];
  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const progressPct = ((stageIndex + 1) / STAGES.length) * 100;

  useEffect(() => {
    const saved = readPartnerLoginCredentials();
    if (!saved?.identifier) return;
    const prefill = prefillIdentifierFromSaved(saved.identifier);
    if (!prefill.email && !prefill.phone) return;
    setForm((f) => ({
      ...f,
      email: f.email || prefill.email || '',
      phone: f.phone || prefill.phone || '',
    }));
  }, []);

  const syncPhoneAutofill = useCallback((value: string) => {
    setForm((f) => (f.phone === value ? f : { ...f, phone: value }));
    setErrors((prev) => (prev.phone ? { ...prev, phone: undefined } : prev));
  }, []);

  const syncEmailAutofill = useCallback((value: string) => {
    setForm((f) => (f.email === value ? f : { ...f, email: value }));
    setErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
  }, []);

  useBrowserAutofillSync(stageIndex === 0, 'snp-phone', syncPhoneAutofill);
  useBrowserAutofillSync(stageIndex === 4, 'snp-email', syncEmailAutofill);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    setSubmitError(null);
  };

  const fieldError = (key: keyof FormState) =>
    errors[key] ? <p className={errorTextClass}>{errors[key]}</p> : null;

  const goNext = () => {
    const stageErrors = validateStage(stageIndex, form);
    if (Object.keys(stageErrors).length > 0) {
      setErrors(stageErrors);
      return;
    }
    setErrors({});
    setStageIndex((i) => Math.min(i + 1, STAGES.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setSubmitError(null);
    setStageIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const stageErrors = validateStage(4, form);
    if (Object.keys(stageErrors).length > 0) {
      setErrors(stageErrors);
      return;
    }

    setSubmitting(true);
    try {
      await partnerApi.postPublic<{ token: string }>('/partners/register', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        gender: form.gender,
        phone: form.phone.trim(),
        whatsapp: form.phone.trim(),
        email: form.email.trim(),
        password: form.password,
        region: form.region,
        town: form.town.trim(),
        occupation: form.occupation.trim(),
        momoNumber: form.momoNumber.trim(),
        momoNetwork: form.momoNetwork,
        schoolsTarget: form.schoolsTarget || null,
        heardFrom: form.heardFrom,
        motivation: form.motivation.trim(),
      });
      const identifier = form.email.trim() || form.phone.trim();
      await persistPartnerLogin(identifier, form.password);
      window.location.href = buildPartnerLoginPrefillUrl(identifier, form.password);
    } catch (err) {
      if (err instanceof PartnerApiError) {
        if (err.fields) {
          setErrors((prev) => ({ ...prev, ...(err.fields as Partial<Record<keyof FormState, string>>) }));
        }
        setSubmitError(err.message);
      } else {
        setSubmitError('Something went wrong. Please check your connection and try again.');
      }
      setSubmitting(false);
    }
  };

  const StageIcon = stage.icon;

  return (
    <form
      onSubmit={stageIndex === STAGES.length - 1 ? handleSubmit : (e) => { e.preventDefault(); goNext(); }}
      noValidate
      autoComplete="on"
      className="scroll-reveal mt-10 rounded-[24px] border border-[var(--sn-border)] bg-white p-6 shadow-[var(--shadow-premium)] sm:p-9"
    >
      {/* Progress */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--brand-dark)]">
            Step {stageIndex + 1} of {STAGES.length}
          </p>
          <p className="text-[12px] font-semibold text-[var(--ink-subtle)]">{Math.round(progressPct)}% complete</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-dark)] transition-all duration-500 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="mt-4 hidden gap-1 sm:grid sm:grid-cols-5">
          {STAGES.map((s, i) => {
            const done = i < stageIndex;
            const active = i === stageIndex;
            return (
              <div key={s.id} className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-extrabold transition ${
                    done
                      ? 'bg-[var(--brand)] text-white'
                      : active
                        ? 'bg-[var(--brand-light)] text-[var(--brand-dark)] ring-2 ring-[var(--brand)]'
                        : 'bg-[var(--surface-3)] text-[var(--ink-subtle)]'
                  }`}
                >
                  {done ? '✓' : s.id}
                </span>
                <span className={`text-[10px] font-bold leading-tight ${active ? 'text-[var(--brand-dark)]' : 'text-[var(--ink-subtle)]'}`}>
                  {s.title}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stage header */}
      <div className="mb-6 flex items-start gap-4 rounded-[18px] border border-[var(--sn-border)] bg-gradient-to-br from-[var(--brand-light)]/60 to-white p-4 sm:p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-[var(--sn-border)]">
          <StageIcon className="h-5 w-5 text-[var(--brand-dark)]" />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="scholar-display text-[18px] font-extrabold text-[var(--ink)] sm:text-[20px]">
            {stage.title}
          </h3>
          <p className="mt-0.5 text-[14px] font-light text-[var(--ink-muted)]">{stage.subtitle}</p>
        </div>
      </div>

      {/* Stage fields */}
      <div className="space-y-5">
        {stageIndex === 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="snp-first">First name</label>
              <input id="snp-first" className={`${fieldClass} ${errors.firstName ? fieldErrorClass : ''}`}
                value={form.firstName} onChange={set('firstName')} placeholder="Kofi" autoComplete="given-name" />
              {fieldError('firstName')}
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-last">Last name</label>
              <input id="snp-last" className={`${fieldClass} ${errors.lastName ? fieldErrorClass : ''}`}
                value={form.lastName} onChange={set('lastName')} placeholder="Mensah" autoComplete="family-name" />
              {fieldError('lastName')}
            </div>
            <div className="sm:col-span-2">
              <span className={labelClass}>Gender</span>
              <div className="grid grid-cols-2 gap-3">
                {PARTNER_GENDERS.map(({ value, label }) => {
                  const selected = form.gender === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({ ...f, gender: value }));
                        setErrors((prev) => (prev.gender ? { ...prev, gender: undefined } : prev));
                      }}
                      className={`rounded-[14px] border px-4 py-3.5 text-[15px] font-bold transition ${
                        selected
                          ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand-dark)] shadow-[0_0_0_4px_var(--brand-glow)]'
                          : 'border-[var(--sn-border)] bg-white text-[var(--ink-muted)] hover:border-[var(--brand)]/40'
                      } ${errors.gender && !selected ? 'border-red-300' : ''}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {fieldError('gender')}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="snp-phone">Phone / WhatsApp</label>
              <input
                id="snp-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                className={`${fieldClass} ${errors.phone ? fieldErrorClass : ''}`}
                value={form.phone}
                onChange={set('phone')}
                placeholder="024 123 4567"
                autoComplete="tel"
              />
              {fieldError('phone')}
              <p className="mt-1.5 text-[12px] text-[var(--ink-subtle)]">We&apos;ll use this to reach you about your application.</p>
            </div>
          </div>
        )}

        {stageIndex === 1 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="snp-region">Region</label>
              <RegionAutocomplete
                id="snp-region"
                value={form.region}
                onChange={(v) => {
                  setForm((f) => ({ ...f, region: v }));
                  setErrors((prev) => (prev.region ? { ...prev, region: undefined } : prev));
                }}
                error={errors.region}
                className={fieldClass}
                errorClassName={fieldErrorClass}
              />
              {fieldError('region')}
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-town">Town / city</label>
              <input id="snp-town" className={`${fieldClass} ${errors.town ? fieldErrorClass : ''}`}
                value={form.town} onChange={set('town')} placeholder="e.g. Kumasi, Tamale, Tema" autoComplete="address-level2" />
              {fieldError('town')}
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="snp-occupation">Occupation</label>
              <input id="snp-occupation" className={fieldClass} value={form.occupation}
                onChange={set('occupation')} placeholder="e.g. Teacher, Trader, Student" />
            </div>
          </div>
        )}

        {stageIndex === 2 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="snp-momo">MoMo number</label>
              <input id="snp-momo" type="tel" className={`${fieldClass} ${errors.momoNumber ? fieldErrorClass : ''}`}
                value={form.momoNumber} onChange={set('momoNumber')} placeholder="024 123 4567" />
              {fieldError('momoNumber')}
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-network">MoMo network</label>
              <select id="snp-network" className={`${fieldClass} ${errors.momoNetwork ? fieldErrorClass : ''}`}
                value={form.momoNetwork} onChange={set('momoNetwork')}>
                <option value="">Select network</option>
                {MOMO_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              {fieldError('momoNetwork')}
            </div>
            <p className="sm:col-span-2 text-[13px] font-light leading-relaxed text-[var(--ink-muted)]">
              Your monthly commissions are paid directly to this MoMo number — no bank account needed.
            </p>
          </div>
        )}

        {stageIndex === 3 && (
          <div className="space-y-5">
            <div>
              <label className={labelClass} htmlFor="snp-heard">How did you hear about the Partner Program?</label>
              <select
                id="snp-heard"
                className={`${fieldClass} ${errors.heardFrom ? fieldErrorClass : ''}`}
                value={form.heardFrom}
                onChange={set('heardFrom')}
              >
                <option value="">Select one</option>
                {HEARD_FROM_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {fieldError('heardFrom')}
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-reach">How many schools can you reach?</label>
              <select id="snp-reach" className={fieldClass} value={form.schoolsTarget} onChange={set('schoolsTarget')}>
                <option value="">Select a range (optional)</option>
                {SCHOOLS_REACH_OPTIONS.map((o) => <option key={o} value={o}>{o} schools</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-motivation">Why do you want to become a partner?</label>
              <textarea id="snp-motivation" rows={4} className={`${fieldClass} resize-none`}
                value={form.motivation} onChange={set('motivation')}
                placeholder="Tell us a little about yourself and your motivation… (optional)" />
            </div>
          </div>
        )}

        {stageIndex === 4 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="snp-email">Email address</label>
              <input
                id="snp-email"
                name="email"
                type="email"
                inputMode="email"
                className={`${fieldClass} ${errors.email ? fieldErrorClass : ''}`}
                value={form.email}
                onChange={set('email')}
                placeholder="you@example.com"
                autoComplete="email"
              />
              {fieldError('email')}
              <p className="mt-1.5 text-[12px] text-[var(--ink-subtle)]">You&apos;ll sign in to your partner dashboard with this email.</p>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className={labelClass} htmlFor="snp-password">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    const pw = suggestPartnerPassword();
                    setForm((f) => ({ ...f, password: pw, confirmPassword: pw }));
                    setShowPassword(true);
                    setErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
                  }}
                  className="text-[12px] font-bold text-[var(--brand-dark)] hover:underline"
                >
                  Suggest password
                </button>
              </div>
              <div className="relative">
                <input id="snp-password" type={showPassword ? 'text' : 'password'}
                  name="new-password"
                  className={`${fieldClass} pr-12 ${errors.password ? fieldErrorClass : ''}`}
                  value={form.password} onChange={set('password')} placeholder={`Min. ${PARTNER_MIN_PASSWORD} characters`}
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-subtle)] transition hover:text-[var(--brand)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.password && (
                <div className="mt-2.5">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                        style={{ background: i < Math.min(strength.score, 4) ? strength.color : 'var(--surface-3)' }} />
                    ))}
                  </div>
                  <p className="mt-1 text-[12px] font-bold" style={{ color: strength.color }}>
                    {strength.label}
                  </p>
                </div>
              )}
              {fieldError('password')}
            </div>
            <div>
              <label className={labelClass} htmlFor="snp-confirm">Confirm password</label>
              <div className="relative">
                <input id="snp-confirm" type={showConfirm ? 'text' : 'password'}
                  name="confirm-password"
                  className={`${fieldClass} pr-12 ${errors.confirmPassword ? fieldErrorClass : ''}`}
                  value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="Repeat password"
                  autoComplete="new-password" />
                <button type="button" onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-subtle)] transition hover:text-[var(--brand)]"
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}>
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldError('confirmPassword')}
            </div>
          </div>
        )}
      </div>

      {submitError && (
        <div className="mt-5 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13.5px] font-semibold text-red-700">
          {submitError}
        </div>
      )}

      {/* Actions */}
      <div className={`mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center ${stageIndex > 0 ? 'sm:justify-between' : 'sm:justify-end'}`}>
        {stageIndex > 0 ? (
          <button
            type="button"
            onClick={goBack}
            disabled={submitting}
            className="inline-flex items-center justify-center gap-1.5 rounded-[14px] border border-[var(--sn-border)] bg-white px-5 py-3.5 text-[15px] font-bold text-[var(--ink-muted)] transition hover:border-[var(--brand)]/30 hover:text-[var(--brand-dark)] disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        ) : null}

        {stageIndex < STAGES.length - 1 ? (
          <button type="submit" className="scholar-btn-primary inline-flex w-full items-center justify-center gap-2 !py-3.5 !text-[16px] sm:w-auto sm:min-w-[160px]">
            Next <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button type="submit" disabled={submitting} className="scholar-btn-primary inline-flex w-full items-center justify-center gap-2 !py-3.5 !text-[16px] sm:min-w-[200px]">
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" /> Creating your account…
              </>
            ) : (
              <>
                Create an account <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[12.5px] font-medium text-[var(--ink-subtle)]">
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--brand)]" />
        Free to join. Approval within 48 hours.
      </p>
    </form>
  );
}
