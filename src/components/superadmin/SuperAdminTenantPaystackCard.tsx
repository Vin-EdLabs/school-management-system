import React, { useEffect, useState } from 'react';
import { CreditCard, Loader2, Save, ShieldCheck, Users, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  fetchSuperAdminTenantPaystack,
  patchSuperAdminTenantPaystack,
  type PaystackFeeBearer,
  type SuperAdminTenantPaystackConfig,
} from '@/services/superAdminPaystackApi';

export default function SuperAdminTenantPaystackCard({ tenantId, tenantName }: { tenantId: number; tenantName: string }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SuperAdminTenantPaystackConfig | null>(null);
  const [superAdminEnabled, setSuperAdminEnabled] = useState(false);
  const [feeBearer, setFeeBearer] = useState<PaystackFeeBearer>('parent');
  const [subaccountCode, setSubaccountCode] = useState('');
  const [payoutAccount, setPayoutAccount] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const c = await fetchSuperAdminTenantPaystack(tenantId);
        if (cancelled) return;
        setConfig(c);
        setSuperAdminEnabled(c.superAdminEnabled);
        setFeeBearer(c.feeBearer);
        setSubaccountCode(c.subaccountCode || '');
        setPayoutAccount(c.payoutAccount || '');
      } catch (e: unknown) {
        if (!cancelled) {
          toast({ title: 'Could not load Paystack settings', description: (e as Error).message, variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await patchSuperAdminTenantPaystack(tenantId, {
        superAdminEnabled,
        feeBearer,
        subaccountCode,
        payoutAccount,
      });
      setConfig(saved);
      toast({ title: 'Paystack settings updated', description: tenantName });
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-center justify-center text-slate-500 text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading Paystack…
      </div>
    );
  }

  const schoolOn = Boolean(config?.enabled);
  const effective = superAdminEnabled && schoolOn;

  return (
    <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/20 dark:to-slate-900/40 dark:border-emerald-900/40 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-emerald-600" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Online payments</p>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Paystack control for this school</p>
        </div>
        <Badge className={cn('border-0 shrink-0', effective ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600')}>
          {effective ? 'Active' : superAdminEnabled ? 'Pending school' : 'Off'}
        </Badge>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Allow online payments</p>
          <p className="text-xs text-slate-500">Super admin approval — school admin must also enable Paystack.</p>
        </div>
        <Switch checked={superAdminEnabled} onCheckedChange={setSuperAdminEnabled} />
      </div>

      <div className="rounded-xl border border-slate-200/80 bg-white/80 p-4 dark:border-slate-700 dark:bg-slate-900/50 space-y-3">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Processing fee bearer</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
              feeBearer === 'parent' ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <input type="radio" name={`fee-${tenantId}`} checked={feeBearer === 'parent'} onChange={() => setFeeBearer('parent')} className="mt-1" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                Parent pays fee
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Paystack fee added on top of the school fee at checkout.</p>
            </div>
          </label>
          <label
            className={cn(
              'flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors',
              feeBearer === 'school' ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-slate-200 hover:border-slate-300'
            )}
          >
            <input type="radio" name={`fee-${tenantId}`} checked={feeBearer === 'school'} onChange={() => setFeeBearer('school')} className="mt-1" />
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-white">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                School pays fee
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">Parents pay only the school fee; processing cost is deducted from school payout.</p>
            </div>
          </label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Payout MoMo / bank</label>
          <Input value={payoutAccount} onChange={(e) => setPayoutAccount(e.target.value)} placeholder="024… or account" className="text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Paystack subaccount</label>
          <Input value={subaccountCode} onChange={(e) => setSubaccountCode(e.target.value)} placeholder="ACCT_…" className="font-mono text-sm" />
        </div>
      </div>

      <p className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        School admin status: {schoolOn ? 'enabled in school panel' : 'not enabled yet'} · Mode: {config?.mode === 'own' ? 'Own Paystack' : 'ScholarNerve merchant'}
      </p>

      <Button size="sm" onClick={() => void handleSave()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save Paystack settings</>}
      </Button>
    </div>
  );
}
