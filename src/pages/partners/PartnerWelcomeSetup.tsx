import React, { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, X } from 'lucide-react';
import { MOMO_NETWORKS, PartnerApiError, partnerApi } from '@/services/partnerApi';
import { usePartnerSession } from '@/pages/partners/partnerSession';
import { PartnerPhotoUpload, PortalCard } from './partnerShared';
import { Button } from '@/components/ui/button';
import PartnerLogo from './PartnerLogo';

const setupKey = (partnerId: number) => `snPartnerSetupDone_${partnerId}`;

export function isPartnerSetupComplete(partnerId: number): boolean {
  try {
    return localStorage.getItem(setupKey(partnerId)) === '1';
  } catch {
    return false;
  }
}

function markSetupComplete(partnerId: number) {
  try {
    localStorage.setItem(setupKey(partnerId), '1');
  } catch {
    /* quota */
  }
}

export default function PartnerWelcomeSetup() {
  const { partner, refresh } = usePartnerSession();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [whatsapp, setWhatsapp] = useState(partner.whatsapp || partner.phone || '');
  const [momoNumber, setMomoNumber] = useState(partner.momoNumber || '');
  const [momoNetwork, setMomoNetwork] = useState(partner.momoNetwork || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (partner.status !== 'pending') return;
    if (isPartnerSetupComplete(partner.id)) return;
    setOpen(true);
  }, [partner.id, partner.status]);

  const dismiss = () => {
    markSetupComplete(partner.id);
    setOpen(false);
  };

  const saveContact = async () => {
    setError(null);
    setSaving(true);
    try {
      await partnerApi.put('/partners/profile', {
        whatsapp: whatsapp.trim(),
        momoNumber: momoNumber.trim(),
        momoNetwork,
      });
      await refresh();
      markSetupComplete(partner.id);
      setOpen(false);
    } catch (err) {
      setError(err instanceof PartnerApiError ? err.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="snp-welcome-setup relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] border border-emerald-200/60 bg-white shadow-2xl sm:rounded-[28px] dark:border-emerald-900/50 dark:bg-slate-900">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="snp-welcome-setup-hero px-6 pb-5 pt-8 text-center sm:px-8 sm:pt-10">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-lg ring-1 ring-emerald-100 dark:bg-slate-800 dark:ring-emerald-900">
            <PartnerLogo variant="compact" className="h-full w-full" />
          </div>
          {step === 0 && (
            <>
              <h2 className="text-xl font-black text-slate-900 dark:text-white sm:text-2xl">
                Welcome, {partner.firstName}!
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                Your account is under review — usually within 48 hours. While you wait, set up your partner profile so you&apos;re ready to go.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Add your photo</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                This appears on your official Partner ID card once approved.
              </p>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Confirm payout details</h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Double-check your MoMo and WhatsApp — commissions are sent here.
              </p>
            </>
          )}
        </div>

        <div className="px-6 pb-8 sm:px-8">
          {step === 0 && (
            <PortalCard className="space-y-3 p-5">
              {[
                'Read How it Works & Partner Rules on your home screen',
                'Upload a clear profile photo',
                'Confirm your MoMo payout number',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </PortalCard>
          )}

          {step === 1 && (
            <div className="flex justify-center py-2">
              <PartnerPhotoUpload partner={partner} onUploaded={() => void refresh()} />
            </div>
          )}

          {step === 2 && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void saveContact();
              }}
            >
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">WhatsApp</label>
                <input
                  className="snp-field-input w-full"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="024 123 4567"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">MoMo number</label>
                <input
                  className="snp-field-input w-full"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  placeholder="024 123 4567"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">MoMo network</label>
                <select
                  className="snp-field-input w-full"
                  value={momoNetwork}
                  onChange={(e) => setMomoNetwork(e.target.value)}
                >
                  <option value="">Select network</option>
                  {MOMO_NETWORKS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}
            </form>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={dismiss} className="text-slate-500">
                Skip for now
              </Button>
            )}

            {step < 2 ? (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => setStep((s) => s + 1)}
              >
                Continue <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={saving}
                onClick={() => void saveContact()}
              >
                {saving ? 'Saving…' : 'Finish setup'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
