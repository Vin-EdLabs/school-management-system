import React, { useCallback, useEffect, useRef, useState } from 'react';
import PaystackPop from '@paystack/inline-js';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  Download,
  History,
  Loader2,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';
import { apiService } from '@/services/api';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import {
  fetchCurrentBilling,
  fetchBillingHistory,
  fetchInvoiceBranding,
  initializeInvoicePayment,
  verifyInvoicePayment,
  type PlatformInvoice,
  type BillingFrequency,
  type InvoiceBranding,
} from '@/services/platformBillingApi';
import PlatformInvoiceDocument, {
  DEFAULT_INVOICE_BRANDING,
  type BillToInfo,
} from './PlatformInvoiceDocument';
import { downloadPlatformInvoicePdf } from './downloadPlatformInvoicePdf';

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

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-400',
  paid: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400',
  waived: 'bg-blue-500/10 text-blue-700 border-blue-500/30 dark:text-blue-400',
  cancelled: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
};

const BillingModule: React.FC = () => {
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<PlatformInvoice | null>(null);
  const [frequency, setFrequency] = useState<BillingFrequency | null>(null);
  const [history, setHistory] = useState<PlatformInvoice[]>([]);
  const [billTo, setBillTo] = useState<BillToInfo>({ name: 'Your school' });
  const [branding, setBranding] = useState<InvoiceBranding>(DEFAULT_INVOICE_BRANDING);
  const [paying, setPaying] = useState(false);
  const [downloadingCurrent, setDownloadingCurrent] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [downloadingRowId, setDownloadingRowId] = useState<number | null>(null);
  const paystackRef = useRef<PaystackPop | null>(null);
  const currentDocRef = useRef<HTMLDivElement | null>(null);
  const expandedDocRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const [current, historyList, brandingData, schoolSettings] = await Promise.all([
        fetchCurrentBilling(),
        fetchBillingHistory(),
        fetchInvoiceBranding().catch(() => DEFAULT_INVOICE_BRANDING),
        apiService.get<Record<string, unknown>>('/settings').catch(() => null),
      ]);
      setInvoice(current.invoice);
      setFrequency(current.billingFrequency);
      setHistory(historyList);
      setBranding(brandingData);
      if (schoolSettings) {
        setBillTo({
          name: String(schoolSettings.school_name || 'Your school'),
          addressLine: (schoolSettings.address as string) || null,
          email: (schoolSettings.email as string) || null,
          phone: (schoolSettings.contact as string) || null,
        });
      }
    } catch (err: unknown) {
      console.error('Failed to load billing info:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const onChange = (evt: { entity?: string }) => {
      if (evt.entity === 'platform-billing') void load();
    };
    socket.on('tenant-data-changed', onChange);
    return () => {
      socket.off('tenant-data-changed', onChange);
    };
  }, [socket, load]);

  const handlePay = async () => {
    if (!invoice) return;
    setPaying(true);
    try {
      const init = await initializeInvoicePayment(invoice.id);
      if (!init.accessCode) throw new Error('Could not start Paystack checkout');

      if (!paystackRef.current) {
        paystackRef.current = new PaystackPop();
      }

      paystackRef.current.resumeTransaction(init.accessCode, {
        onSuccess: async (transaction: { reference?: string }) => {
          try {
            const updated = await verifyInvoicePayment(transaction.reference || init.reference);
            toast({
              title: 'Payment successful',
              description: `${money(updated.paidAmount ?? updated.finalAmount)} received. Your receipt is ready.`,
            });
            await load();
          } catch (err: unknown) {
            toast({
              title: 'Payment received — confirming…',
              description: err instanceof Error ? err.message : 'Refresh in a moment to see your receipt.',
              variant: 'destructive',
            });
          } finally {
            setPaying(false);
          }
        },
        onCancel: () => setPaying(false),
        onError: (error: { message?: string }) => {
          setPaying(false);
          toast({
            title: 'Payment could not open',
            description: error?.message || 'Please try again.',
            variant: 'destructive',
          });
        },
      });
    } catch (err: unknown) {
      toast({
        title: 'Could not start payment',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
      setPaying(false);
    }
  };

  const handleDownloadCurrent = async () => {
    if (!invoice || !currentDocRef.current) return;
    setDownloadingCurrent(true);
    try {
      await downloadPlatformInvoicePdf(currentDocRef.current, invoice);
    } catch (err: unknown) {
      toast({
        title: 'Could not download PDF',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingCurrent(false);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleDownloadRow = async (row: PlatformInvoice) => {
    setDownloadingRowId(row.id);
    try {
      if (expandedId !== row.id) {
        setExpandedId(row.id);
        // Wait a tick for the accordion content (and its ref) to mount.
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (expandedDocRef.current) {
        await downloadPlatformInvoicePdf(expandedDocRef.current, row);
      }
    } catch (err: unknown) {
      toast({
        title: 'Could not download PDF',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingRowId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Your school's ScholarNerve subscription invoices, payments, and receipts.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <BrandedLoading label="Loading billing status…" className="py-10" />
      ) : (
        <div className="space-y-6">
          {invoice ? (
            <PlatformInvoiceDocument ref={currentDocRef} invoice={invoice} billTo={billTo} branding={branding}>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="h-11 flex-1 rounded-xl font-bold text-white"
                  style={{ backgroundColor: '#0D7377' }}
                  disabled={paying}
                  onClick={() => void handlePay()}
                >
                  {paying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Opening secure checkout…
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-4 w-4" />
                      Pay {money(invoice.finalAmount)} with Paystack
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-xl font-semibold"
                  disabled={downloadingCurrent}
                  onClick={() => void handleDownloadCurrent()}
                >
                  {downloadingCurrent ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download PDF
                </Button>
              </div>
            </PlatformInvoiceDocument>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-emerald-900 dark:text-emerald-100">You're all caught up</p>
                <p className="text-sm text-emerald-800/80 dark:text-emerald-200/70">
                  No outstanding ScholarNerve invoice right now
                  {frequency ? ` — billed ${frequency}.` : '.'}
                </p>
              </div>
            </div>
          )}

          {history.length > 0 ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <History className="h-4 w-4 text-slate-500" />
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Payment history</p>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map((row) => {
                  const isExpanded = expandedId === row.id;
                  return (
                    <div key={row.id}>
                      <button
                        type="button"
                        onClick={() => toggleExpand(row.id)}
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/40"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {row.invoiceNumber || `Invoice #${row.id}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.periodLabel} · {formatDate(row.createdAt)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-bold uppercase', STATUS_BADGE[row.status])}
                          >
                            {row.status}
                          </Badge>
                          <span className="font-mono font-semibold tabular-nums">{money(row.finalAmount)}</span>
                          <span
                            role="button"
                            tabIndex={0}
                            aria-label="Download PDF"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDownloadRow(row);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                void handleDownloadRow(row);
                              }
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                          >
                            {downloadingRowId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </span>
                          <ChevronDown
                            className={cn('h-4 w-4 text-slate-400 transition-transform', isExpanded && 'rotate-180')}
                          />
                        </div>
                      </button>

                      {isExpanded ? (
                        <div className="animate-in fade-in slide-in-from-top-1 border-t border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                          <PlatformInvoiceDocument ref={expandedDocRef} invoice={row} billTo={billTo} branding={branding} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default BillingModule;
