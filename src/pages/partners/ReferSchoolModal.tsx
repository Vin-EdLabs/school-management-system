import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Calendar, CheckCircle2, Loader2, MapPin, Phone, Sparkles, User, Users, X,
} from 'lucide-react';
import { PartnerApiError, partnerApi, type PartnerLead } from '@/services/partnerApi';
import { Button } from '@/components/ui/button';
import RegionAutocomplete from './RegionAutocomplete';
import { usePartnerSession } from '@/pages/partners/partnerSession';

function ReferField({
  id,
  label,
  hint,
  icon: Icon,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  icon: typeof Building2;
  children: React.ReactNode;
}) {
  return (
    <div className="snp-refer-field">
      <label htmlFor={id} className="snp-refer-label">
        <Icon className="h-3.5 w-3.5 text-emerald-500" />
        {label}
        {hint ? <span className="ml-1 font-normal text-slate-400">({hint})</span> : null}
      </label>
      {children}
    </div>
  );
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReferSchoolModal({
  open,
  onClose,
  onSubmitted,
}: {
  open: boolean;
  onClose: () => void;
  onSubmitted: (lead: PartnerLead) => void;
}) {
  const navigate = useNavigate();
  const { partner } = usePartnerSession();
  const [schoolName, setSchoolName] = useState('');
  const [proprietorName, setProprietorName] = useState('');
  const [phone, setPhone] = useState('');
  const [region, setRegion] = useState('');
  const [regionTouched, setRegionTouched] = useState(false);
  const [studentCount, setStudentCount] = useState('');
  const [demoDate, setDemoDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const defaultRegion = partner.region || '';

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setRegion(defaultRegion);
    setRegionTouched(false);
    return () => { document.body.style.overflow = prev; };
  }, [open, defaultRegion]);

  const minDemoDate = useMemo(() => todayIsoDate(), [open]);

  if (!open) return null;

  const reset = () => {
    setSchoolName('');
    setProprietorName('');
    setPhone('');
    setRegion('');
    setRegionTouched(false);
    setStudentCount('');
    setDemoDate('');
    setError(null);
    setSuccess(false);
    setSubmitting(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const goTrack = () => {
    close();
    navigate('/schools');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!schoolName.trim()) {
      setError('School name is required');
      return;
    }
    if (!demoDate) {
      setError('Pick a preferred date for the demo');
      return;
    }
    setSubmitting(true);
    try {
      const result = await partnerApi.post<{ lead: PartnerLead }>('/partners/leads', {
        schoolName: schoolName.trim(),
        proprietorName: proprietorName.trim(),
        phone: phone.trim(),
        region: region.trim() || defaultRegion,
        studentCount: studentCount.trim(),
        demoDate,
      });
      setSuccess(true);
      onSubmitted(result.lead);
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : 'Failed to submit referral');
      setSubmitting(false);
    }
  };

  return createPortal(
    <div
      className="snp-refer-overlay fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      onClick={close}
      role="presentation"
    >
      <div
        className="snp-pop snp-refer-modal flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-emerald-100/30 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="refer-school-title"
      >
        <div className="snp-refer-hero relative shrink-0">
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 rounded-full bg-white/15 p-2 text-white transition hover:bg-white/25 hover:scale-105"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3.5 px-5 pt-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 shadow-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 pb-1 pt-0.5">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-emerald-100/90">
                <Sparkles className="h-3 w-3" /> Partner referral
              </p>
              <h2 id="refer-school-title" className="mt-0.5 text-xl font-black tracking-tight">Refer School</h2>
              <p className="mt-1 text-xs leading-relaxed text-emerald-50/85">
                ScholarNerve may call the school — or you can visit again in person. When the demo is booked, the meeting link appears on that school in My Schools.
              </p>
            </div>
          </div>
        </div>

        {success ? (
          <div className="snp-refer-form-body max-h-[min(75dvh,620px)] space-y-4 overflow-y-auto px-5 py-5">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-100 dark:bg-emerald-950/50 dark:ring-emerald-900">
                <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">School referred!</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Track your follow-up score on My Schools. When ScholarNerve books the demo, the Google Meet or Zoom link will appear on that school.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button type="button" onClick={goTrack} className="h-11 flex-1 rounded-xl bg-emerald-600 font-bold hover:bg-emerald-700">
                Track on My Schools
              </Button>
              <Button type="button" variant="outline" onClick={close} className="h-11 flex-1 rounded-xl font-bold">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="snp-refer-form-body max-h-[min(70dvh,580px)] space-y-4 overflow-y-auto px-5 py-4" noValidate>
            <div className="snp-refer-tip rounded-xl bg-emerald-50/70 px-3.5 py-3 text-xs leading-relaxed text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              Your region is pre-filled. Change it only if this school is elsewhere. All fields use smooth focus — tap and type naturally.
            </div>

            <ReferField id="snp-lead-name" label="School name" icon={Building2}>
              <input
                id="snp-lead-name"
                className="snp-refer-input"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g. Bright Future Academy"
                autoFocus
              />
            </ReferField>

            <div className="grid gap-4 sm:grid-cols-2">
              <ReferField id="snp-lead-prop" label="Proprietor / Head teacher" icon={User}>
                <input
                  id="snp-lead-prop"
                  className="snp-refer-input"
                  value={proprietorName}
                  onChange={(e) => setProprietorName(e.target.value)}
                  placeholder="Owner or head teacher"
                />
              </ReferField>
              <ReferField id="snp-lead-phone" label="Phone number" icon={Phone}>
                <input
                  id="snp-lead-phone"
                  type="tel"
                  className="snp-refer-input"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="024 123 4567"
                />
              </ReferField>
            </div>

            <ReferField id="snp-lead-region" label="Region" hint="searchable" icon={MapPin}>
              <RegionAutocomplete
                id="snp-lead-region"
                value={regionTouched ? region : (region || defaultRegion)}
                onChange={(v) => {
                  setRegionTouched(true);
                  setRegion(v);
                }}
                placeholder={defaultRegion ? `${defaultRegion} — change if needed` : 'Start typing region…'}
                className="snp-refer-input !rounded-[0.875rem]"
              />
            </ReferField>

            <div className="grid gap-4 sm:grid-cols-2">
              <ReferField id="snp-lead-count" label="Estimated students" icon={Users}>
                <input
                  id="snp-lead-count"
                  type="number"
                  min={1}
                  className="snp-refer-input"
                  value={studentCount}
                  onChange={(e) => setStudentCount(e.target.value)}
                  placeholder="e.g. 250"
                />
              </ReferField>
              <ReferField id="snp-lead-demo" label="Preferred demo date" icon={Calendar}>
                <input
                  id="snp-lead-demo"
                  type="date"
                  min={minDemoDate}
                  className="snp-refer-input"
                  value={demoDate}
                  onChange={(e) => setDemoDate(e.target.value)}
                  required
                />
              </ReferField>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="h-12 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-bold shadow-lg shadow-emerald-900/20 transition hover:from-emerald-700 hover:to-teal-700 hover:shadow-xl disabled:opacity-70"
            >
              {submitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
              ) : (
                'Submit'
              )}
            </Button>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
