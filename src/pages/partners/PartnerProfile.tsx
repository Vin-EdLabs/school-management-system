import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Copy, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import {
  MOMO_NETWORKS, PartnerApiError, PartnerProfile as PartnerProfileType,
  TIER_META, partnerApi,
} from '@/services/partnerApi';
import { usePartnerSession } from '@/pages/partners/partnerSession';
import {
  PartnerPhotoUpload, PartnerPage, PortalCard, TierBadge,
} from './partnerShared';
import PartnerIdCardShowcase from './PartnerIdCardShowcase';
import RegionAutocomplete from './RegionAutocomplete';
import { PARTNER_MIN_PASSWORD, persistPartnerLogin } from './partnerPasswordUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TIER_ORDER = ['partner', 'senior_partner', 'team_leader', 'regional_director'] as const;

export default function PartnerProfilePage() {
  const { partner, stats, refresh, logout } = usePartnerSession();
  const [searchParams] = useSearchParams();
  const passwordRef = useRef<HTMLDivElement>(null);

  const [whatsapp, setWhatsapp] = useState(partner.whatsapp || '');
  const [email, setEmail] = useState(partner.email || '');
  const [region, setRegion] = useState(partner.region || '');
  const [town, setTown] = useState(partner.town || '');
  const [momoNumber, setMomoNumber] = useState(partner.momoNumber || '');
  const [momoNetwork, setMomoNetwork] = useState(partner.momoNetwork || '');
  const [emailCurrentPassword, setEmailCurrentPassword] = useState('');
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactError, setContactError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const tierProgress = useMemo(() => {
    const idx = TIER_ORDER.indexOf(partner.tier);
    const nextTier = idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
    if (!nextTier) return null;
    const nextMin = TIER_META[nextTier].min;
    const currentMin = TIER_META[partner.tier].min;
    const span = nextMin - currentMin || 1;
    const progress = Math.min(100, Math.max(4, ((stats.activeSchools - currentMin) / span) * 100));
    return {
      nextLabel: TIER_META[nextTier].label,
      needed: Math.max(0, nextMin - stats.activeSchools),
      progress,
    };
  }, [partner.tier, stats.activeSchools]);

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);
    if (email.trim().toLowerCase() !== partner.email.toLowerCase() && !emailCurrentPassword) {
      setContactError('Enter your current password to change your email');
      return;
    }
    setSavingContact(true);
    try {
      const payload: Record<string, string | undefined> = {
        whatsapp: whatsapp.trim(),
        region: region.trim(),
        town: town.trim(),
        momoNumber: momoNumber.trim(),
        momoNetwork,
      };
      if (email.trim().toLowerCase() !== partner.email.toLowerCase()) {
        payload.email = email.trim();
        payload.currentPassword = emailCurrentPassword;
      }
      await partnerApi.put<{ partner: PartnerProfileType }>('/partners/profile', payload);
      if (email.trim().toLowerCase() !== partner.email.toLowerCase()) {
        await persistPartnerLogin(email.trim(), emailCurrentPassword);
      }
      setEmailCurrentPassword('');
      await refresh();
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2200);
    } catch (err) {
      setContactError(err instanceof PartnerApiError ? err.message : 'Failed to save changes');
    } finally {
      setSavingContact(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    if (newPassword.length < PARTNER_MIN_PASSWORD) {
      setPasswordError(`New password must be at least ${PARTNER_MIN_PASSWORD} characters`);
      return;
    }
    if (newPassword !== confirmNew) {
      setPasswordError('Passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await partnerApi.put('/partners/profile', { currentPassword, newPassword });
      await persistPartnerLogin(partner.email, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNew('');
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 2200);
    } catch (err) {
      setPasswordError(err instanceof PartnerApiError ? err.message : 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const copyId = async () => {
    if (!partner.partnerId) return;
    try {
      await navigator.clipboard.writeText(partner.partnerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  useEffect(() => {
    if (searchParams.get('section') === 'password' && passwordRef.current) {
      passwordRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [searchParams]);

  return (
    <PartnerPage>
      <div className="mb-1">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white sm:text-2xl">My Profile</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Partner ID, photo, and payout details</p>
      </div>

      <PortalCard className="p-4 sm:p-6">
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6">
          <PartnerPhotoUpload partner={partner} onUploaded={() => void refresh()} />
          <div className="w-full min-w-0 flex-1 text-center sm:text-left">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
              {partner.firstName} {partner.lastName}
            </p>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{partner.email}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {partner.partnerId ? (
                <button
                  type="button"
                  onClick={copyId}
                  className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-extrabold tracking-wide text-emerald-800"
                >
                  {partner.partnerId}
                  {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              ) : null}
              <TierBadge tier={partner.tier} />
            </div>
            {tierProgress && partner.status === 'approved' ? (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">
                    Next tier: <span className="text-slate-900 dark:text-white">{tierProgress.nextLabel}</span>
                  </span>
                  <span className="font-bold text-emerald-600">{tierProgress.needed} more schools</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-700"
                    style={{ width: `${tierProgress.progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </PortalCard>

      {partner.status === 'approved' && partner.partnerId ? (
        <PartnerIdCardShowcase partner={partner} variant="full" />
      ) : (
        <PortalCard className="border-amber-200/80 bg-amber-50/80 p-5 text-center">
          <p className="text-sm font-semibold text-amber-900">
            Your official Partner ID card unlocks once your application is approved.
          </p>
        </PortalCard>
      )}

      <PortalCard className="divide-y divide-slate-100">
        {[
          ['Phone', partner.phone],
          ['Member since', new Date(partner.createdAt).toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <span className="text-sm font-semibold text-slate-400 dark:text-slate-500">{label}</span>
            <span className="text-right text-sm font-bold text-slate-900 dark:text-white">{value}</span>
          </div>
        ))}
      </PortalCard>

      <form onSubmit={saveContact}>
        <PortalCard className="p-5 sm:p-6">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Contact & account</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Emails from ScholarNerve are sent to your account email below.</p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snp-profile-email">Email address</Label>
              <Input id="snp-profile-email" type="email" className="h-11 rounded-xl" value={email}
                onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {email.trim().toLowerCase() !== partner.email.toLowerCase() ? (
              <div className="space-y-2">
                <Label htmlFor="snp-profile-email-pw">Current password (required to change email)</Label>
                <Input id="snp-profile-email-pw" type="password" className="h-11 rounded-xl" value={emailCurrentPassword}
                  onChange={(e) => setEmailCurrentPassword(e.target.value)} autoComplete="current-password" />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="snp-profile-region">Region</Label>
              <RegionAutocomplete
                id="snp-profile-region"
                value={region}
                onChange={setRegion}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-profile-town">Town / city</Label>
              <Input id="snp-profile-town" className="h-11 rounded-xl" value={town}
                onChange={(e) => setTown(e.target.value)} placeholder="Your town or city" autoComplete="address-level2" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-profile-wa">WhatsApp number</Label>
              <Input id="snp-profile-wa" type="tel" className="h-11 rounded-xl" value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)} placeholder="024 123 4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-profile-momo">MoMo number</Label>
              <Input id="snp-profile-momo" type="tel" className="h-11 rounded-xl" value={momoNumber}
                onChange={(e) => setMomoNumber(e.target.value)} placeholder="024 123 4567" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-profile-network">MoMo network</Label>
              <select
                id="snp-profile-network"
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                value={momoNetwork}
                onChange={(e) => setMomoNetwork(e.target.value)}
              >
                {MOMO_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>
          {contactError ? <p className="mt-3 text-sm font-medium text-red-600">{contactError}</p> : null}
          <Button type="submit" disabled={savingContact} className="mt-5 rounded-xl bg-emerald-600 hover:bg-emerald-700">
            {savingContact ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</>
            ) : contactSaved ? (
              <><CheckCircle2 className="mr-2 h-4 w-4" /> Saved!</>
            ) : (
              'Save Changes'
            )}
          </Button>
        </PortalCard>
      </form>

      <form onSubmit={savePassword} ref={passwordRef}>
        <PortalCard className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Change password</h2>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="snp-pw-current">Current password</Label>
              <Input id="snp-pw-current" type="password" className="h-11 rounded-xl" value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-pw-new">New password</Label>
              <Input id="snp-pw-new" type="password" className="h-11 rounded-xl" value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} placeholder={`Min. ${PARTNER_MIN_PASSWORD} characters`} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="snp-pw-confirm">Confirm new password</Label>
              <Input id="snp-pw-confirm" type="password" className="h-11 rounded-xl" value={confirmNew}
                onChange={(e) => setConfirmNew(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          {passwordError ? <p className="mt-3 text-sm font-medium text-red-600">{passwordError}</p> : null}
          <Button type="submit" disabled={savingPassword} variant="outline" className="mt-5 rounded-xl">
            {savingPassword ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…</>
            ) : passwordSaved ? (
              <><CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> Password updated!</>
            ) : (
              'Update Password'
            )}
          </Button>
        </PortalCard>
      </form>

      <Button
        type="button"
        variant="outline"
        onClick={logout}
        className="h-12 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50"
      >
        <LogOut className="mr-2 h-4 w-4" />
        Log Out
      </Button>
    </PartnerPage>
  );
}
