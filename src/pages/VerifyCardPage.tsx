import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveLogoUrl } from '@/services/tenantService';
import {
  AlertTriangle,
  BadgeCheck,
  Globe,
  Loader2,
  Phone,
  ShieldAlert,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

type VerificationStatus = 'verified' | 'revoked' | 'inactive';

type VerifyCardData = {
  entityType: string;
  entityId: number;
  cardId: string;
  fullName: string;
  idNumber: string;
  cardTypeLabel: string;
  schoolName: string;
  phone: string;
  website: string;
  logoUrl: string | null;
  photoUrl: string | null;
  verified: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt: string | null;
};

type View = 'card' | 'form' | 'success';

const API_BASE = import.meta.env.VITE_API_BASE_URL || `${window.location.origin}/api`;

function formatVerifiedDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

const VerifyCardPage: React.FC = () => {
  const { entityType = '', entityId = '' } = useParams<{ entityType: string; entityId: string }>();
  const [card, setCard] = useState<VerifyCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('card');
  const [reportId, setReportId] = useState<string | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [buttonLoading, setButtonLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [foundLocation, setFoundLocation] = useState('');
  const [collectionPoint, setCollectionPoint] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [successContact, setSuccessContact] = useState({ schoolName: '', phone: '', website: '' });

  const loadCard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/verify/${entityType}/${entityId}`);
      if (!res.ok) {
        let message = 'ID information not found';
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          /* use default */
        }
        throw new Error(message);
      }
      const data = (await res.json()) as VerifyCardData;
      setCard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ID information not found');
      setCard(null);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void loadCard();
  }, [loadCard]);

  const handleReportLostCard = async () => {
    if (!card) return;
    setButtonLoading(true);
    const start = Date.now();
    try {
      const res = await fetch(`${API_BASE}/verify/${entityType}/${entityId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'INITIAL', cardId: `${entityType}/${entityId}` }),
      });
      if (!res.ok) throw new Error('Report failed');
      const data = (await res.json()) as { reportId: string; referenceCode: string };
      setReportId(data.reportId);
      setReferenceCode(data.referenceCode);
      const elapsed = Date.now() - start;
      if (elapsed < 300) await new Promise((r) => setTimeout(r, 300 - elapsed));
      setView('form');
    } catch {
      setError('Could not send report. Please try again.');
    } finally {
      setButtonLoading(false);
    }
  };

  const submitDetails = async (skip = false) => {
    if (!reportId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/verify/report/${reportId}/report-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          foundLocation: skip ? null : foundLocation,
          collectionPoint: skip ? null : collectionPoint,
          reporterPhone: skip ? null : reporterPhone,
          skipped: skip,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const data = (await res.json()) as {
        referenceCode: string;
        schoolName: string;
        phone: string;
        website: string;
      };
      setReferenceCode(data.referenceCode);
      setSuccessContact({ schoolName: data.schoolName, phone: data.phone, website: data.website });
      setSkipped(skip);
      setView('success');
    } catch {
      setError('Could not save details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 px-4">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <Loader2 className="h-9 w-9 animate-spin text-emerald-600" />
          <p className="text-sm font-medium">Verifying ID card…</p>
        </div>
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-50 via-rose-50/30 to-slate-100 px-4 py-10">
        <div className="w-full max-w-md overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-xl shadow-rose-100/60">
          <div className="bg-gradient-to-r from-rose-500 to-red-600 px-6 py-8 text-center text-white">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15 ring-4 ring-white/20">
              <ShieldAlert className="h-8 w-8" strokeWidth={2} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">ID Information Not Found</h1>
            <p className="mt-1 text-sm text-rose-100">No valid ID record for this scan</p>
          </div>
          <div className="px-6 py-6 text-center">
            <p className="text-sm leading-relaxed text-slate-600">{error}</p>
            <p className="mt-4 text-xs text-slate-400">
              If you found a lost card, please contact the school directly.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const photo = resolveLogoUrl(card.photoUrl);
  const logo = resolveLogoUrl(card.logoUrl);
  const isVerified = card.verified && card.verificationStatus === 'verified';
  const verifiedDate = formatVerifiedDate(card.verifiedAt);

  const statusConfig = isVerified
    ? {
        headerClass: 'from-emerald-500 via-emerald-600 to-teal-600',
        ringClass: 'ring-emerald-100',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        icon: ShieldCheck,
        title: 'Verified',
        subtitle: 'This ID card is authentic and active',
      }
    : {
        headerClass: 'from-slate-500 via-slate-600 to-slate-700',
        ringClass: 'ring-slate-100',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
        icon: ShieldAlert,
        title: 'Not Verified',
        subtitle: 'This person is no longer active at this school',
      };

  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 via-indigo-50/30 to-slate-100 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white shadow-2xl shadow-slate-200/70">
          {view === 'card' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Verification header */}
              <div className={`bg-gradient-to-br ${statusConfig.headerClass} px-6 pb-8 pt-8 text-white`}>
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-white/15 ring-4 ${statusConfig.ringClass} backdrop-blur-sm`}
                  >
                    <StatusIcon className="h-9 w-9" strokeWidth={2.25} />
                  </div>
                  <div
                    className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusConfig.badgeClass}`}
                  >
                    {isVerified && <BadgeCheck className="h-3.5 w-3.5" />}
                    {statusConfig.title}
                  </div>
                  <h1 className="text-lg font-bold tracking-tight sm:text-xl">{statusConfig.subtitle}</h1>
                  {isVerified && verifiedDate && (
                    <p className="mt-2 text-xs text-emerald-100/90">Issued {verifiedDate}</p>
                  )}
                </div>
              </div>

              {/* School + holder details */}
              <div className="relative -mt-5 px-5 pb-6">
                <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-lg shadow-slate-100/80">
                  <div className="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
                    {logo ? (
                      <img src={logo} alt="" className="h-11 w-11 shrink-0 rounded-lg object-contain" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <UserRound className="h-5 w-5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{card.schoolName}</p>
                      <p className="text-xs text-slate-500">Official ID verification</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center text-center">
                    {photo ? (
                      <div className="relative mb-4">
                        <img
                          src={photo}
                          alt=""
                          className="h-32 w-28 rounded-xl border-[3px] border-[#1a3a6b] object-cover shadow-md"
                        />
                        {isVerified && (
                          <span className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                            <BadgeCheck className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4 flex h-32 w-28 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                        <UserRound className="h-10 w-10 text-slate-300" />
                      </div>
                    )}

                    <h2 className="text-xl font-bold uppercase tracking-wide text-[#1a3a6b]">{card.fullName}</h2>
                    <p className="mt-1 font-mono text-sm font-medium text-slate-700">{card.idNumber}</p>
                    <span className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {card.cardTypeLabel}
                    </span>
                  </div>

                  {(card.phone || card.website) && (
                    <div className="mt-5 space-y-2 rounded-lg bg-slate-50 p-3">
                      {card.phone && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Phone className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>{card.phone}</span>
                        </div>
                      )}
                      {card.website && (
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                          <span>{card.website}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Lost card action */}
              <div className="border-t border-slate-100 px-5 pb-6 pt-2">
                <p className="mb-3 text-center text-xs text-slate-500">
                  Found this card? Let the school know so it can be returned.
                </p>
                <button
                  type="button"
                  onClick={() => void handleReportLostCard()}
                  disabled={buttonLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-red-200 transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-70"
                >
                  {buttonLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <AlertTriangle className="h-4 w-4" />
                  )}
                  Report Lost Card
                </button>
              </div>
            </div>
          )}

          {view === 'form' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 p-5 duration-300 sm:p-6">
              <button
                type="button"
                onClick={() => setView('card')}
                className="mb-4 text-sm font-medium text-slate-500 transition hover:text-slate-800"
              >
                ← Back to verification
              </button>

              <div className="mb-5 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-emerald-900">School has been notified</p>
                  <p className="mt-0.5 text-xs text-emerald-700">Your report was sent immediately.</p>
                </div>
              </div>

              <h2 className="text-lg font-bold text-slate-900">Lost Card Report</h2>
              <p className="mb-5 text-sm text-slate-500">Help us locate this card</p>

              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Where did you find it?</label>
              <textarea
                value={foundLocation}
                onChange={(e) => setFoundLocation(e.target.value)}
                placeholder="Where exactly did you find or see the card?"
                rows={3}
                className="mb-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none ring-emerald-500/0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mb-4 text-xs text-slate-400">
                e.g. &quot;Found near Kaneshie market, on the pavement beside the bus stop&quot;
              </p>

              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Where can we reach you to collect the card?{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <textarea
                value={collectionPoint}
                onChange={(e) => setCollectionPoint(e.target.value)}
                placeholder="Where can the school reach you or collect the card?"
                rows={3}
                className="mb-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />
              <p className="mb-4 text-xs text-slate-400">
                e.g. &quot;I work at the shop opposite Accra Mall, available after 5pm&quot;
              </p>

              <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                Your phone <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <input
                type="tel"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="Your phone number (so the school can call you)"
                className="mb-5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20"
              />

              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitDetails(false)}
                className="w-full rounded-xl bg-[#1a3a6b] px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#152f57] disabled:cursor-wait disabled:opacity-70"
              >
                {submitting ? 'Sending…' : 'Send Details →'}
              </button>

              <p className="my-4 text-center text-xs text-slate-400">or</p>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submitDetails(true)}
                className="mx-auto block text-xs text-slate-500 underline transition hover:text-slate-700 disabled:cursor-wait"
              >
                Skip — I already notified someone at the school
              </button>
            </div>
          )}

          {view === 'success' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 p-6 text-center duration-300 sm:p-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <BadgeCheck className="h-8 w-8" strokeWidth={2.25} />
              </div>
              <h2 className="text-xl font-bold text-emerald-800">Thank you!</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                {skipped
                  ? 'The school has been notified. You can contact them directly using the details below.'
                  : 'The school has been notified and your details have been sent.'}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Someone from {successContact.schoolName || card.schoolName} will follow up if needed.
              </p>
              {referenceCode && (
                <p className="mt-4 inline-block rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600">
                  Reference: #{referenceCode}
                </p>
              )}

              <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-left">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">School contact</p>
                {successContact.phone || card.phone ? (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Phone className="h-4 w-4 text-slate-400" />
                    {successContact.phone || card.phone}
                  </div>
                ) : null}
                {successContact.website || card.website ? (
                  <div className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                    <Globe className="h-4 w-4 text-slate-400" />
                    {successContact.website || card.website}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-400">
          Powered by ScholarNerve · Secure ID verification
        </p>
      </div>
    </div>
  );
};

export default VerifyCardPage;
