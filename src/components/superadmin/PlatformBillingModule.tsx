import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogBody,
  detailDialogBodyClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
  dialogLabelClass,
  dialogTitleClass,
  dialogSectionClass,
  DetailField,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Building2,
  CheckCircle2,
  Download,
  Eye,
  History,
  Loader2,
  Receipt,
  RefreshCw,
  Send,
  Settings2,
  Users,
} from 'lucide-react';
import {
  fetchActiveStudentCount,
  fetchBillingConfig,
  saveBillingConfig,
  fetchTenantInvoices,
  postTenantInvoice,
  markInvoicePaid,
  fetchSchoolBillingInfo,
  fetchInvoiceBrandingAdmin,
  saveInvoiceBranding,
  type BillingFrequency,
  type PlatformBillingConfig,
  type PlatformInvoice,
  type InvoiceBranding,
} from '@/services/platformBillingApi';
import PlatformInvoiceDocument, {
  DEFAULT_INVOICE_BRANDING,
  type BillToInfo,
} from '@/components/billing/PlatformInvoiceDocument';
import { downloadPlatformInvoicePdf } from '@/components/billing/downloadPlatformInvoicePdf';

type School = { id: number; name: string; is_active?: boolean };

type PlatformBillingModuleProps = {
  schools: School[];
};

function money(n: number) {
  return `GH₵ ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

const FREQUENCY_OPTIONS: Array<{ value: BillingFrequency; label: string; description: string }> = [
  { value: 'termly', label: 'Termly', description: 'Bill once per academic term.' },
  { value: 'yearly', label: 'Yearly', description: 'Bill once per academic year.' },
  { value: 'monthly', label: 'Monthly', description: 'Bill every calendar month.' },
];

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  waived: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',
  cancelled: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
};

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

const PlatformBillingModule: React.FC<PlatformBillingModuleProps> = ({ schools }) => {
  const [tenantId, setTenantId] = useState<number | null>(schools[0]?.id ?? null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [config, setConfig] = useState<PlatformBillingConfig | null>(null);
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);

  const [frequency, setFrequency] = useState<BillingFrequency>('termly');
  const [priceTermly, setPriceTermly] = useState('0');
  const [priceYearly, setPriceYearly] = useState('0');
  const [priceMonthly, setPriceMonthly] = useState('0');
  const [savingConfig, setSavingConfig] = useState(false);

  const [finalAmount, setFinalAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [posting, setPosting] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);

  const [viewingInvoice, setViewingInvoice] = useState<PlatformInvoice | null>(null);
  const [billTo, setBillTo] = useState<BillToInfo>({ name: 'School' });
  const [downloadingView, setDownloadingView] = useState(false);
  const [markPaidTarget, setMarkPaidTarget] = useState<PlatformInvoice | null>(null);
  const [markingPaid, setMarkingPaid] = useState(false);
  const viewDocRef = React.useRef<HTMLDivElement | null>(null);

  const [branding, setBranding] = useState<InvoiceBranding>(DEFAULT_INVOICE_BRANDING);
  const [brandingForm, setBrandingForm] = useState<InvoiceBranding>(DEFAULT_INVOICE_BRANDING);
  const [savingBranding, setSavingBranding] = useState(false);
  const [loadingBranding, setLoadingBranding] = useState(true);

  const selectedSchool = schools.find((s) => s.id === tenantId) ?? null;

  const tierPrice = useMemo(() => {
    if (frequency === 'yearly') return parseFloat(priceYearly) || 0;
    if (frequency === 'monthly') return parseFloat(priceMonthly) || 0;
    return parseFloat(priceTermly) || 0;
  }, [frequency, priceTermly, priceYearly, priceMonthly]);

  const computedAmount = useMemo(
    () => Math.round((activeCount ?? 0) * tierPrice * 100) / 100,
    [activeCount, tierPrice]
  );

  const effectiveFinalAmount = useMemo(() => {
    if (finalAmount.trim() === '') return computedAmount;
    const parsed = parseFloat(finalAmount);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : computedAmount;
  }, [finalAmount, computedAmount]);

  const hasConfig = !!config;
  const isFullyWaived = effectiveFinalAmount <= 0;

  const loadAll = useCallback(async (id: number) => {
    setLoadingMeta(true);
    try {
      const [count, cfg, invoiceList, schoolInfo] = await Promise.all([
        fetchActiveStudentCount(id),
        fetchBillingConfig(id),
        fetchTenantInvoices(id),
        fetchSchoolBillingInfo(id).catch(() => null),
      ]);
      setActiveCount(count);
      setConfig(cfg);
      setInvoices(invoiceList);
      if (schoolInfo) {
        setBillTo({
          name: schoolInfo.name,
          addressLine: schoolInfo.address,
          email: schoolInfo.email,
          phone: schoolInfo.contact,
        });
      }
      if (cfg) {
        setFrequency(cfg.billingFrequency);
        setPriceTermly(String(cfg.pricePerStudentTermly));
        setPriceYearly(String(cfg.pricePerStudentYearly));
        setPriceMonthly(String(cfg.pricePerStudentMonthly));
      } else {
        setFrequency('termly');
        setPriceTermly('0');
        setPriceYearly('0');
        setPriceMonthly('0');
      }
    } catch (err: unknown) {
      toast({
        title: 'Could not load billing data',
        description: err instanceof Error ? err.message : 'Failed to load billing information',
        variant: 'destructive',
      });
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    setFinalAmount('');
    setNote('');
    setDueDate(defaultDueDate());
    void loadAll(tenantId);
  }, [tenantId, loadAll]);

  useEffect(() => {
    setLoadingBranding(true);
    fetchInvoiceBrandingAdmin()
      .then((b) => {
        setBranding(b);
        setBrandingForm(b);
      })
      .catch(() => {
        setBranding(DEFAULT_INVOICE_BRANDING);
        setBrandingForm(DEFAULT_INVOICE_BRANDING);
      })
      .finally(() => setLoadingBranding(false));
  }, []);

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const saved = await saveInvoiceBranding(brandingForm);
      setBranding(saved);
      setBrandingForm(saved);
      toast({ title: 'Invoice branding saved', description: 'New invoices will use these details.' });
    } catch (err: unknown) {
      toast({
        title: 'Could not save branding',
        description: err instanceof Error ? err.message : 'Failed to save invoice branding',
        variant: 'destructive',
      });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!tenantId) return;
    setSavingConfig(true);
    try {
      const saved = await saveBillingConfig(tenantId, {
        billingFrequency: frequency,
        pricePerStudentTermly: parseFloat(priceTermly) || 0,
        pricePerStudentYearly: parseFloat(priceYearly) || 0,
        pricePerStudentMonthly: parseFloat(priceMonthly) || 0,
      });
      setConfig(saved);
      toast({ title: 'Billing configuration saved', description: `${selectedSchool?.name} will be billed ${saved.billingFrequency}.` });
    } catch (err: unknown) {
      toast({
        title: 'Could not save configuration',
        description: err instanceof Error ? err.message : 'Failed to save billing configuration',
        variant: 'destructive',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  const handlePostInvoice = async () => {
    if (!tenantId) return;
    setPosting(true);
    try {
      const invoice = await postTenantInvoice(tenantId, {
        finalAmount: effectiveFinalAmount,
        note: note.trim() || null,
        dueDate: dueDate || null,
      });
      setInvoices((prev) => [invoice, ...prev]);
      setFinalAmount('');
      setNote('');
      setPostConfirmOpen(false);
      toast({
        title: isFullyWaived ? 'Bill posted — fully waived' : 'Bill posted',
        description: `${invoice.invoiceNumber} — ${money(invoice.finalAmount)} for ${invoice.studentCount} student(s). The school has been notified.`,
      });
      void loadAll(tenantId);
    } catch (err: unknown) {
      toast({
        title: 'Could not post bill',
        description: err instanceof Error ? err.message : 'Failed to post invoice',
        variant: 'destructive',
      });
    } finally {
      setPosting(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!tenantId || !markPaidTarget) return;
    setMarkingPaid(true);
    try {
      const updated = await markInvoicePaid(tenantId, markPaidTarget.id);
      setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      toast({
        title: 'Invoice marked as paid',
        description: `${updated.invoiceNumber} — ${money(updated.finalAmount)} reconciled manually.`,
      });
      setMarkPaidTarget(null);
    } catch (err: unknown) {
      toast({
        title: 'Could not mark as paid',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setMarkingPaid(false);
    }
  };

  const handleDownloadView = async () => {
    if (!viewingInvoice || !viewDocRef.current) return;
    setDownloadingView(true);
    try {
      await downloadPlatformInvoicePdf(viewDocRef.current, viewingInvoice);
    } catch (err: unknown) {
      toast({
        title: 'Could not download PDF',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingView(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="font-outfit text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            Platform Billing
          </h3>
          <p className="max-w-2xl text-sm font-medium text-slate-500">
            Bill schools their ScholarNerve subscription per active student — set a frequency and price once, then
            post bills whenever you're ready. Suspension for non-payment is always manual.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => tenantId && void loadAll(tenantId)}
          disabled={!tenantId || loadingMeta}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', loadingMeta && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="font-outfit text-lg font-black">Invoice branding</CardTitle>
              <CardDescription>
                The "From" details and default notes shown on every ScholarNerve invoice and receipt — applies
                platform-wide.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          {loadingBranding ? (
            <BrandedLoading label="Loading invoice branding…" className="py-6" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Company name</Label>
                  <Input
                    value={brandingForm.companyName}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, companyName: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Tagline</Label>
                  <Input
                    value={brandingForm.tagline}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, tagline: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Address</Label>
                  <Input
                    value={brandingForm.address}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, address: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Email</Label>
                  <Input
                    value={brandingForm.email}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Phone</Label>
                  <Input
                    value={brandingForm.phone}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, phone: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>MoMo number (shown on unpaid invoices)</Label>
                  <Input
                    value={brandingForm.momoNumber || ''}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, momoNumber: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Bank name</Label>
                  <Input
                    value={brandingForm.bankName || ''}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, bankName: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Bank account name</Label>
                  <Input
                    value={brandingForm.bankAccountName || ''}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, bankAccountName: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label className={dialogLabelClass}>Bank account number</Label>
                  <Input
                    value={brandingForm.bankAccountNumber || ''}
                    onChange={(e) => setBrandingForm((f) => ({ ...f, bankAccountNumber: e.target.value }))}
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className={dialogLabelClass}>Default notes (shown on unpaid invoices)</Label>
                <Textarea
                  value={brandingForm.defaultNotes || ''}
                  onChange={(e) => setBrandingForm((f) => ({ ...f, defaultNotes: e.target.value }))}
                  className="min-h-20 rounded-xl"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl font-bold sm:w-auto"
                disabled={savingBranding}
                onClick={() => void handleSaveBranding()}
              >
                {savingBranding ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Save invoice branding
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm dark:border-slate-800">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-2">
            <Label className={dialogLabelClass}>School</Label>
            <Select value={tenantId != null ? String(tenantId) : ''} onValueChange={(v) => setTenantId(v ? Number(v) : null)}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select school…" />
              </SelectTrigger>
              <SelectContent>
                {schools.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    #{s.id} — {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedSchool ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2 text-sm dark:border-slate-800 dark:bg-slate-900/50">
              <span className="font-semibold text-slate-800 dark:text-slate-100">{selectedSchool.name}</span>
              <span className="ml-2 text-muted-foreground">Tenant #{selectedSchool.id}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {tenantId && loadingMeta ? (
        <BrandedLoading label="Loading billing data…" className="py-10" />
      ) : tenantId ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-6">
            {/* Active student count */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-outfit text-lg font-black">Active students</CardTitle>
                    <CardDescription>Fetched live — this is what a bill will be based on.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between rounded-xl border border-indigo-200/70 bg-indigo-50/50 px-4 py-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                  <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                    Currently active students
                  </span>
                  <span className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{activeCount ?? '—'}</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Re-checked fresh the moment you post a bill, so this can't go stale.
                </p>
              </CardContent>
            </Card>

            {/* Billing frequency & pricing config */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
                    <Settings2 className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-outfit text-lg font-black">Billing configuration</CardTitle>
                    <CardDescription>
                      Set once — applies to every future bill for this school until changed.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                {!hasConfig ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
                    No billing configuration yet for this school — set it up below before posting a bill.
                  </div>
                ) : null}

                <RadioGroup value={frequency} onValueChange={(v) => setFrequency(v as BillingFrequency)} className="grid gap-3">
                  {FREQUENCY_OPTIONS.map((opt) => {
                    const selected = frequency === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all',
                          selected
                            ? 'border-emerald-300 bg-emerald-50/60 shadow-sm dark:border-emerald-700/50 dark:bg-emerald-950/25'
                            : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/40 dark:hover:border-slate-700'
                        )}
                      >
                        <RadioGroupItem value={opt.value} id={`freq-${opt.value}`} className="mt-1" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{opt.label}</span>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">{opt.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </RadioGroup>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label className={dialogLabelClass}>Price / student (termly)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceTermly}
                      onChange={(e) => setPriceTermly(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={dialogLabelClass}>Price / student (yearly)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceYearly}
                      onChange={(e) => setPriceYearly(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className={dialogLabelClass}>Price / student (monthly)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceMonthly}
                      onChange={(e) => setPriceMonthly(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl font-bold"
                  disabled={savingConfig}
                  onClick={() => void handleSaveConfig()}
                >
                  {savingConfig ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save billing configuration
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* Post a bill */}
            <Card className="border-emerald-200/90 shadow-sm dark:border-emerald-900/50 xl:sticky xl:top-4">
              <CardHeader className="border-b border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    <Send className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-outfit text-lg font-black">Post a bill</CardTitle>
                    <CardDescription>
                      Generates an invoice for {selectedSchool?.name || 'this school'} and notifies Admin,
                      Headmaster &amp; Finance.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Students × price</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">
                      {activeCount ?? 0} × {money(tierPrice)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950/40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Computed amount</p>
                    <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{money(computedAmount)}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Final amount (editable — set to 0 for 100% discount)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={computedAmount.toFixed(2)}
                    value={finalAmount}
                    onChange={(e) => setFinalAmount(e.target.value)}
                    className="h-11 rounded-xl font-mono"
                  />
                  {isFullyWaived ? (
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                      This bill will be posted as fully waived — no payment required.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Due date</Label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-11 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label className={dialogLabelClass}>Note to school (optional)</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Promo discount for early renewal, or a reminder about payment terms…"
                    className="min-h-20 rounded-xl"
                  />
                </div>

                <Button
                  type="button"
                  className="h-11 w-full rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700"
                  disabled={!hasConfig || loadingMeta}
                  onClick={() => setPostConfirmOpen(true)}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Review &amp; post bill
                </Button>
              </CardContent>
            </Card>

            {/* Invoice history for this school */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800">
              <CardHeader className="border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-600">
                    <History className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="font-outfit text-lg font-black">Billing history</CardTitle>
                    <CardDescription>All invoices posted to this school.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices posted yet for this school.</p>
                ) : (
                  <div className="max-h-96 space-y-2 overflow-y-auto">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {inv.invoiceNumber || `Invoice #${inv.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {inv.periodLabel} · {formatDate(inv.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px] font-bold uppercase', STATUS_BADGE[inv.status])}>
                            {inv.status}
                          </Badge>
                          <span className="font-mono font-semibold tabular-nums">{money(inv.finalAmount)}</span>
                          {inv.status === 'pending' ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-lg border-emerald-300 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                              onClick={() => setMarkPaidTarget(inv)}
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Mark paid
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-lg px-2"
                            onClick={() => setViewingInvoice(inv)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Select a school to manage its billing.</p>
      )}

      {/* Post bill confirmation */}
      <Dialog open={postConfirmOpen} onOpenChange={setPostConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Receipt className="h-5 w-5" />
              </span>
              Confirm bill
            </DialogTitle>
            <DialogDescription>
              This generates an invoice and notifies {selectedSchool?.name || 'the school'}'s Admin, Headmaster and
              Finance.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className={cn(detailDialogBodyClass, 'space-y-4')}>
            <div className={dialogSectionClass}>
              <DetailField label="School">{selectedSchool?.name}</DetailField>
              <DetailField label="Frequency">{frequency}</DetailField>
              <DetailField label="Students billed">{activeCount ?? 0}</DetailField>
              <DetailField label="Price per student">{money(tierPrice)}</DetailField>
              <DetailField label="Computed amount">{money(computedAmount)}</DetailField>
              <DetailField label="Final amount due">
                <span className={cn('font-black', isFullyWaived ? 'text-blue-600' : 'text-emerald-600')}>
                  {money(effectiveFinalAmount)}
                </span>
              </DetailField>
              {dueDate ? <DetailField label="Due date">{formatDate(dueDate)}</DetailField> : null}
              {note.trim() ? <DetailField label="Note">{note.trim()}</DetailField> : null}
            </div>
          </DialogBody>
          <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row')}>
            <Button variant="outline" className="w-full rounded-xl sm:w-auto" onClick={() => setPostConfirmOpen(false)} disabled={posting}>
              Cancel
            </Button>
            <Button
              className="w-full rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 sm:w-auto"
              disabled={posting}
              onClick={() => void handlePostInvoice()}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Post bill
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View invoice/receipt */}
      <Dialog open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <DialogHeader className={cn(detailDialogHeaderClass, 'sr-only')}>
            <DialogTitle className={dialogTitleClass}>Invoice {viewingInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {viewingInvoice ? (
            <DialogBody className={cn(detailDialogBodyClass, '!p-0')}>
              <PlatformInvoiceDocument ref={viewDocRef} invoice={viewingInvoice} billTo={billTo} branding={branding}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-xl font-semibold"
                  disabled={downloadingView}
                  onClick={() => void handleDownloadView()}
                >
                  {downloadingView ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </PlatformInvoiceDocument>
            </DialogBody>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mark as paid confirmation */}
      <Dialog open={!!markPaidTarget} onOpenChange={(open) => !open && setMarkPaidTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className={cn(dialogTitleClass, 'flex items-center gap-3')}>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              Mark as paid
            </DialogTitle>
            <DialogDescription>
              Use this when the school paid outside Paystack (bank transfer, cash, momo). This does not charge
              anything — it just reconciles the invoice.
            </DialogDescription>
          </DialogHeader>
          {markPaidTarget ? (
            <DialogBody className={cn(detailDialogBodyClass, 'space-y-2')}>
              <div className={dialogSectionClass}>
                <DetailField label="Invoice">{markPaidTarget.invoiceNumber}</DetailField>
                <DetailField label="Amount">{money(markPaidTarget.finalAmount)}</DetailField>
                <DetailField label="Period">{markPaidTarget.periodLabel}</DetailField>
              </div>
            </DialogBody>
          ) : null}
          <DialogFooter className={cn(detailDialogFooterClass, 'flex-col gap-2 sm:flex-row')}>
            <Button
              variant="outline"
              className="w-full rounded-xl sm:w-auto"
              onClick={() => setMarkPaidTarget(null)}
              disabled={markingPaid}
            >
              Cancel
            </Button>
            <Button
              className="w-full rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-700 sm:w-auto"
              disabled={markingPaid}
              onClick={() => void handleMarkPaid()}
            >
              {markingPaid ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Marking paid…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm — mark as paid
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlatformBillingModule;
