import React, { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck, Users, Building2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  fetchPaystackConfig, savePaystackConfig, type PaystackConfigPublic, type PaystackMode, type PaystackFeeBearer,
} from '@/services/onlinePaymentApi';
import PaystackKeyField from './PaystackKeyField';

export default function PaystackSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PaystackConfigPublic | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [mode, setMode] = useState<PaystackMode>('scholarnerve');
  const [feeBearer, setFeeBearer] = useState<PaystackFeeBearer>('parent');
  const [payoutAccount, setPayoutAccount] = useState('');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [ownPublicKey, setOwnPublicKey] = useState('');
  const [ownSecretKey, setOwnSecretKey] = useState('');

  useEffect(() => {
    void (async () => {
      try {
        const c = await fetchPaystackConfig();
        setConfig(c);
        setEnabled(c.enabled);
        setMode(c.mode);
        setFeeBearer(c.feeBearer || 'parent');
        setPayoutAccount(c.payoutAccount || '');
        setSubaccountCode(c.subaccountCode || '');
        setOwnPublicKey(c.ownPublicKey || '');
      } catch (e: unknown) {
        toast({ title: 'Could not load Paystack settings', description: (e as Error).message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await savePaystackConfig({
        enabled,
        mode,
        feeBearer,
        payoutAccount,
        subaccountCode,
        ownPublicKey,
        ownSecretKey: ownSecretKey.trim() || undefined,
      });
      setConfig(saved);
      setOwnSecretKey('');
      toast({ title: 'Paystack settings saved' });
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading settings…
      </div>
    );
  }

  const scholarnerveReady = Boolean(subaccountCode.trim());
  const ownReady = Boolean(config?.hasOwnKeys || (ownPublicKey.trim() && ownSecretKey.trim()));
  const teamApproved = config?.superAdminEnabled === true;
  const effectiveLive = Boolean(config?.effectiveEnabled ?? (enabled && teamApproved));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {!teamApproved ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Awaiting ScholarNerve team approval</p>
            <p className="mt-1 text-xs leading-relaxed">Online payments are not yet enabled for your school. Contact support or wait for the ScholarNerve team to approve your request.</p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-slate-900">Enable online payments</p>
            <p className="mt-1 text-xs text-slate-500">Allow parents to pay school fees via MoMo, card, or bank.</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!teamApproved} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="outline" className="text-[10px]">
            ScholarNerve team: {teamApproved ? 'Approved' : 'Pending'}
          </Badge>
          <Badge className={cn('border-0 text-[10px]', effectiveLive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
            {effectiveLive ? 'Live for parents' : 'Not visible to parents'}
          </Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <p className="text-sm font-bold text-slate-900">Paystack processing fee</p>
        <p className="text-xs text-slate-500">Choose who covers Paystack&apos;s transaction fee (~1.95%). The ScholarNerve team can also configure this for your school if needed.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
              feeBearer === 'parent' ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-200'
            )}
          >
            <input type="radio" name="fee-bearer" checked={feeBearer === 'parent'} onChange={() => setFeeBearer('parent')} className="mt-1" />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users className="h-4 w-4 text-emerald-600" />
                Parent pays fee
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Fee is added at checkout — parents see the full total before paying.</p>
            </div>
          </label>
          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors',
              feeBearer === 'school' ? 'border-emerald-400 bg-emerald-50/50' : 'border-slate-200 hover:border-emerald-200'
            )}
          >
            <input type="radio" name="fee-bearer" checked={feeBearer === 'school'} onChange={() => setFeeBearer('school')} className="mt-1" />
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Building2 className="h-4 w-4 text-emerald-600" />
                School pays fee
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Parents pay only the school fee amount — your payout is reduced by the processing fee.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <p className="text-sm font-bold text-slate-900">Payment mode</p>

        <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 hover:border-emerald-300">
          <input type="radio" name="paystack-mode" checked={mode === 'scholarnerve'} onChange={() => setMode('scholarnerve')} className="mt-1" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Use ScholarNerve Payment (recommended)</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Payments go through TechNerve&apos;s secure merchant account. Your school receives funds directly to your registered MoMo or bank account.
            </p>
          </div>
        </label>

        <label className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-4 hover:border-emerald-300">
          <input type="radio" name="paystack-mode" checked={mode === 'own'} onChange={() => setMode('own')} className="mt-1" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Use my own Paystack account</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Connect your school&apos;s Paystack account directly.</p>
          </div>
        </label>
      </div>

      {mode === 'scholarnerve' ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-900">ScholarNerve merchant setup</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${scholarnerveReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {scholarnerveReady ? 'Connected' : 'Setup required'}
            </span>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">School MoMo number or bank account</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              value={payoutAccount}
              onChange={(e) => setPayoutAccount(e.target.value)}
              placeholder="e.g. 024 123 4567 or bank account"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Paystack subaccount code</label>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-mono"
              value={subaccountCode}
              onChange={(e) => setSubaccountCode(e.target.value)}
              placeholder="ACCT_xxxxxxxxxx"
            />
          </div>
          <p className="flex items-start gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            Parents can pay online as soon as online payments are enabled. Add a Paystack subaccount when ready so funds split directly to your MoMo or bank — until then, payments go through ScholarNerve&apos;s merchant account.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-slate-900">Your Paystack keys</p>
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ownReady ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
              {config?.hasOwnKeys ? 'Keys saved' : 'Keys required'}
            </span>
          </div>
          <PaystackKeyField
            label="Public key"
            value={ownPublicKey}
            onChange={setOwnPublicKey}
            placeholder="pk_live_..."
            hasSaved={Boolean(config?.ownPublicKey)}
          />
          <PaystackKeyField
            label="Secret key"
            value={ownSecretKey}
            onChange={setOwnSecretKey}
            placeholder="sk_live_..."
            hasSaved={Boolean(config?.hasOwnKeys)}
          />
        </div>
      )}

      <Button onClick={() => void handleSave()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save settings</>}
      </Button>
    </div>
  );
}
