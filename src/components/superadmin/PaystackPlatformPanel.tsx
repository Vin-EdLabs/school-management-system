import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CreditCard, Loader2, RefreshCw, Save, Shield, Zap, Building2, Search, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PaystackKeyField from '@/components/paystack/PaystackKeyField';
import {
  fetchPlatformPaystackConfig,
  fetchTenantPaystackSummaries,
  patchSuperAdminTenantPaystack,
  savePlatformPaystackConfig,
  type PlatformPaystackConfig,
  type TenantPaystackSummary,
} from '@/services/superAdminPaystackApi';

export default function PaystackPlatformPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<PlatformPaystackConfig | null>(null);
  const [useLiveKeys, setUseLiveKeys] = useState(false);
  const [testPublicKey, setTestPublicKey] = useState('');
  const [livePublicKey, setLivePublicKey] = useState('');
  const [testSecretKey, setTestSecretKey] = useState('');
  const [liveSecretKey, setLiveSecretKey] = useState('');
  const [tenants, setTenants] = useState<TenantPaystackSummary[]>([]);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantLoading, setTenantLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadPlatform = useCallback(async () => {
    setLoading(true);
    try {
      const c = await fetchPlatformPaystackConfig();
      setConfig(c);
      setUseLiveKeys(c.useLiveKeys);
      setTestPublicKey(c.testPublicKey || '');
      setLivePublicKey(c.livePublicKey || '');
      setTestSecretKey(c.envTestSecretKey || '');
      setLiveSecretKey('');
    } catch (e: unknown) {
      toast({ title: 'Could not load Paystack settings', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTenants = useCallback(async (search?: string) => {
    setTenantLoading(true);
    try {
      const rows = await fetchTenantPaystackSummaries(search);
      setTenants(rows);
    } catch (e: unknown) {
      toast({ title: 'Could not load schools', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTenantLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlatform();
    void loadTenants();
  }, [loadPlatform, loadTenants]);

  const handleSavePlatform = async () => {
    setSaving(true);
    try {
      const saved = await savePlatformPaystackConfig({
        useLiveKeys,
        testPublicKey: testPublicKey.trim() || undefined,
        livePublicKey: livePublicKey.trim() || undefined,
        testSecretKey: testSecretKey.trim() || undefined,
        liveSecretKey: liveSecretKey.trim() || undefined,
      });
      setConfig(saved);
      setUseLiveKeys(saved.useLiveKeys);
      setTestPublicKey(saved.testPublicKey || '');
      setLivePublicKey(saved.livePublicKey || '');
      setTestSecretKey(saved.envTestSecretKey || '');
      setLiveSecretKey('');
      toast({ title: 'Platform Paystack settings saved' });
    } catch (e: unknown) {
      toast({ title: 'Save failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleTenantOnline = async (row: TenantPaystackSummary, next: boolean) => {
    setTogglingId(row.tenantId);
    try {
      await patchSuperAdminTenantPaystack(row.tenantId, { superAdminEnabled: next });
      setTenants((prev) =>
        prev.map((t) =>
          t.tenantId === row.tenantId
            ? { ...t, superAdminEnabled: next, effectiveEnabled: next && t.schoolEnabled }
            : t
        )
      );
      toast({ title: next ? 'Online payments approved' : 'Online payments disabled', description: row.tenantName });
    } catch (e: unknown) {
      toast({ title: 'Update failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setTogglingId(null);
    }
  };

  const filteredTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) => t.tenantName.toLowerCase().includes(q) || String(t.tenantId) === q
    );
  }, [tenants, tenantSearch]);

  const testReady = Boolean(
    (testPublicKey.trim() || config?.testPublicKey) &&
    (testSecretKey.trim() || config?.hasTestSecret)
  );
  const liveReady = Boolean(config?.livePublicKey && config?.hasLiveSecret);
  const activeMode = useLiveKeys ? 'live' : 'test';
  const activeReady = useLiveKeys ? liveReady : testReady;

  if (loading && !config) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading Paystack…
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="absolute right-0 top-0 h-48 w-48 translate-x-1/3 -translate-y-1/3 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
              <CreditCard className="h-3.5 w-3.5" />
              ScholarNerve Payments
            </div>
            <h3 className="font-outfit text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Paystack Platform Control
            </h3>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500">
              Store test and live API keys centrally, switch between modes, and approve online payments per school.
            </p>
          </div>
          <Button variant="outline" onClick={() => { void loadPlatform(); void loadTenants(tenantSearch); }} disabled={loading || saving}>
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Payment environment</p>
              <p className="mt-1 text-xs text-slate-500">When live mode is on, all ScholarNerve-mode schools use live keys.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
              <span className={cn('text-xs font-bold', !useLiveKeys && 'text-emerald-700')}>Test</span>
              <Switch checked={useLiveKeys} onCheckedChange={setUseLiveKeys} />
              <span className={cn('text-xs font-bold', useLiveKeys && 'text-amber-700')}>Live</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge className={cn('border-0', testReady ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
              {testReady ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              Test keys {testReady ? 'ready' : 'incomplete'}
            </Badge>
            <Badge className={cn('border-0', liveReady ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
              {liveReady ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              Live keys {liveReady ? 'ready' : 'incomplete'}
            </Badge>
            <Badge className={cn('border-0', activeReady ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-800')}>
              <Zap className="mr-1 h-3 w-3" />
              Active: {activeMode.toUpperCase()}
            </Badge>
          </div>

          {useLiveKeys && !liveReady ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <Shield className="mt-0.5 h-4 w-4 shrink-0" />
              Live mode is enabled but live keys are missing. Parents will not be able to pay until both live public and secret keys are saved.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm dark:border-slate-800 dark:from-slate-900/80 dark:to-slate-900/40">
          <p className="text-sm font-bold text-slate-900 dark:text-white">How it works</p>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            <li className="flex gap-2"><span className="font-bold text-emerald-600">1.</span> Save test keys for development and live keys for production.</li>
            <li className="flex gap-2"><span className="font-bold text-emerald-600">2.</span> Toggle live mode only when you are ready to accept real payments.</li>
            <li className="flex gap-2"><span className="font-bold text-emerald-600">3.</span> Approve each school below — the school must also enable online payments in their admin panel.</li>
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase tracking-widest">Test</Badge>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Test API keys</p>
            {config?.testPublicKeyFromEnv || config?.testSecretFromEnv ? (
              <Badge variant="outline" className="text-[10px]">Prefilled from .env</Badge>
            ) : null}
          </div>
          <PaystackKeyField
            label="Public key"
            value={testPublicKey}
            onChange={setTestPublicKey}
            placeholder="pk_test_..."
            hasSaved={Boolean(config?.testPublicKey && !config?.testPublicKeyFromEnv)}
          />
          <PaystackKeyField
            label="Secret key"
            value={testSecretKey}
            onChange={setTestSecretKey}
            placeholder="sk_test_..."
            hasSaved={Boolean(config?.hasTestSecret && !config?.testSecretFromEnv)}
          />
          {config?.testSecretFromEnv ? (
            <p className="text-xs text-slate-500">
              Test secret loaded from server <code className="text-emerald-700">PAYSTACK_SECRET_KEY</code>. Edit here to save in the platform database instead.
            </p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm dark:border-amber-900/40 dark:bg-slate-900/50 space-y-4">
          <div className="flex items-center gap-2">
            <Badge className="border-0 bg-amber-100 text-amber-800 text-[10px] uppercase tracking-widest">Live</Badge>
            <p className="text-sm font-bold text-slate-900 dark:text-white">Live API keys</p>
          </div>
          <PaystackKeyField label="Public key" value={livePublicKey} onChange={setLivePublicKey} placeholder="pk_live_..." hasSaved={Boolean(config?.livePublicKey)} />
          <PaystackKeyField
            label="Secret key"
            value={liveSecretKey}
            onChange={setLiveSecretKey}
            placeholder="sk_live_..."
            hasSaved={Boolean(config?.hasLiveSecret)}
          />
        </div>
      </div>

      <Button onClick={() => void handleSavePlatform()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
        {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : <><Save className="mr-2 h-4 w-4" /> Save platform keys</>}
      </Button>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/50 overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <p className="text-sm font-bold text-slate-900 dark:text-white">School online payments</p>
            </div>
            <p className="mt-1 text-xs text-slate-500">Approve or revoke online payments per tenant. Schools must also enable Paystack in their admin panel.</p>
          </div>
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={tenantSearch}
              onChange={(e) => setTenantSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void loadTenants(tenantSearch); }}
              placeholder="Search schools…"
              className="pl-9"
            />
          </div>
        </div>

        {tenantLoading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading schools…
          </div>
        ) : filteredTenants.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No schools found.</p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTenants.map((row) => (
              <div key={row.tenantId} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{row.tenantName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">ID {row.tenantId}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {row.mode === 'own' ? 'Own Paystack' : 'ScholarNerve'}
                    </Badge>
                    {row.effectiveEnabled ? (
                      <Badge className="border-0 bg-emerald-50 text-emerald-700 text-[10px]">Live for parents</Badge>
                    ) : row.superAdminEnabled && !row.schoolEnabled ? (
                      <Badge className="border-0 bg-amber-50 text-amber-800 text-[10px]">Awaiting school</Badge>
                    ) : row.schoolEnabled && !row.superAdminEnabled ? (
                      <Badge className="border-0 bg-slate-100 text-slate-600 text-[10px]">Not approved</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Off</Badge>
                    )}
                    <span className="text-[10px] text-slate-400">
                      Fee: {row.feeBearer === 'school' ? 'School pays' : 'Parent pays'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-semibold text-slate-600">Super admin approve</span>
                  <Switch
                    checked={row.superAdminEnabled}
                    disabled={togglingId === row.tenantId}
                    onCheckedChange={(v) => void toggleTenantOnline(row, v)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
