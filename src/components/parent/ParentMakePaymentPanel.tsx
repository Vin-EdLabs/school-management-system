import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Upload, CheckCircle2, Clock, XCircle, Loader2, Eye, ChevronDown, Landmark } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PaymentProofImageDialog from '@/components/payments/PaymentProofImageDialog';
import {
  fetchMyPaymentSubmissions,
  fetchParentPaymentDetails,
  fetchPaymentProofBlobUrl,
  submitPaymentProof,
  type PaymentSubmission,
  type SchoolPaymentDetails,
} from '@/services/parentPaymentSubmissionApi';
import { fetchParentOnlineConfig } from '@/services/onlinePaymentApi';
import { formatDisplayDateTime } from '@/utils/dateFormat';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import ParentOnlinePaymentPanel from './ParentOnlinePaymentPanel';
import type { OnlinePaymentReceipt } from '@/services/onlinePaymentApi';

interface LinkedStudent {
  id: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

interface ParentMakePaymentPanelProps {
  token: string;
  linkedStudents: LinkedStudent[];
  defaultStudentId?: number;
  resolveMediaUrl: (url: string | null | undefined) => string | null;
  logoUrl?: string | null;
  outstandingAmount?: number;
  schoolName?: string;
  onOnlinePaymentSuccess?: (payment: OnlinePaymentReceipt) => void | Promise<void>;
}

const NETWORKS = ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo', 'Bank Transfer'] as const;

function CopyRow({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value.trim());
      toast({ title: 'Copied', description: `${label} copied to clipboard.` });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
  };
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-slate-900 break-words">{value}</p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
      >
        <Copy className="h-3.5 w-3.5" /> Copy
      </button>
    </div>
  );
}

function PaymentMethodCard({
  title,
  number,
  accountName,
}: {
  title: string;
  number?: string;
  accountName?: string;
}) {
  if (!number?.trim() && !accountName?.trim()) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">{title}</p>
      <CopyRow label="Number" value={number || ''} />
      <CopyRow label="Account name" value={accountName || ''} />
    </div>
  );
}

function StatusBadge({ status }: { status: PaymentSubmission['status'] }) {
  if (status === 'reviewed') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
      </span>
    );
  }
  if (status === 'rejected') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
        <XCircle className="h-3.5 w-3.5" /> Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
      <Clock className="h-3.5 w-3.5" /> Pending
    </span>
  );
}

const ParentMakePaymentPanel: React.FC<ParentMakePaymentPanelProps> = ({
  token,
  linkedStudents,
  defaultStudentId,
  resolveMediaUrl,
  logoUrl,
  outstandingAmount,
  schoolName,
  onOnlinePaymentSuccess,
}) => {
  const [details, setDetails] = useState<SchoolPaymentDetails | null>(null);
  const [history, setHistory] = useState<PaymentSubmission[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const hasLoadedRef = useRef(false);
  const [studentId, setStudentId] = useState(String(defaultStudentId || linkedStudents[0]?.id || ''));
  const [amount, setAmount] = useState('');
  const [network, setNetwork] = useState<(typeof NETWORKS)[number]>('MTN MoMo');
  const [reference, setReference] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [proofLoadingId, setProofLoadingId] = useState<number | null>(null);
  const [onlinePaymentsEnabled, setOnlinePaymentsEnabled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const openProofPreview = async (row: PaymentSubmission) => {
    if (!row.screenshotUrl || !token) return;
    setProofLoadingId(row.id);
    try {
      const url = await fetchPaymentProofBlobUrl(token, row.id);
      setImagePreview({
        url,
        title: 'Payment proof screenshot',
        subtitle: `GHS ${Number(row.amountClaimed).toLocaleString('en-GH', { minimumFractionDigits: 2 })} · ${row.networkUsed} · ${formatDisplayDateTime(row.submittedAt)}`,
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast({ title: 'Could not load screenshot', description: err?.message, variant: 'destructive' });
    } finally {
      setProofLoadingId(null);
    }
  };

  const closeImagePreview = (open: boolean) => {
    if (!open) {
      if (imagePreview?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreview.url);
      }
      setImagePreview(null);
    }
  };

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) return;
    const silent = options?.silent ?? hasLoadedRef.current;
    if (!silent) setInitialLoading(true);
    try {
      const [d, h, onlineCfg] = await Promise.all([
        fetchParentPaymentDetails(token),
        fetchMyPaymentSubmissions(token),
        fetchParentOnlineConfig(token).catch(() => ({ enabled: false })),
      ]);
      setDetails(d);
      setHistory(h);
      setOnlinePaymentsEnabled(Boolean(onlineCfg?.enabled));
      hasLoadedRef.current = true;
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (!silent) {
        toast({ title: 'Could not load payment info', description: err?.message, variant: 'destructive' });
      }
    } finally {
      if (!silent) setInitialLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (defaultStudentId) setStudentId(String(defaultStudentId));
  }, [defaultStudentId]);

  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const handleFile = (file: File | null) => {
    if (!file) {
      setScreenshot(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Images only', description: 'Please upload a screenshot image.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Maximum size is 5MB.', variant: 'destructive' });
      return;
    }
    setScreenshot(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !studentId || !screenshot) {
      toast({ title: 'Complete the form', description: 'Student, amount, network, and screenshot are required.', variant: 'destructive' });
      return;
    }
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append('studentId', studentId);
      form.append('amountClaimed', String(parsedAmount));
      form.append('networkUsed', network);
      if (reference.trim()) form.append('transactionReference', reference.trim());
      form.append('screenshot', screenshot);
      await submitPaymentProof(token, form);
      toast({ title: 'Payment submitted', description: 'Finance will review your proof shortly.' });
      setAmount('');
      setReference('');
      setScreenshot(null);
      await load({ silent: true });
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast({ title: 'Submission failed', description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading && !hasLoadedRef.current) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center shadow-sm">
        <BrandedLoading logoUrl={logoUrl} label="Loading payment options…" className="py-2" />
      </div>
    );
  }

  const manualPaymentContent = (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">School payment details</h3>
        <p className="text-xs text-slate-600">Pay using the details below, then submit your proof of payment.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <PaymentMethodCard
            title="MTN MoMo"
            number={details?.mtnMomoNumber}
            accountName={details?.mtnMomoName}
          />
          <PaymentMethodCard
            title="Vodafone Cash"
            number={details?.vodafoneCashNumber}
            accountName={details?.vodafoneCashName}
          />
          <PaymentMethodCard
            title="AirtelTigo"
            number={details?.airteltigoNumber}
            accountName={details?.airteltigoName}
          />
          {details?.merchantId?.trim() ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <CopyRow label="Merchant ID" value={details.merchantId} />
            </div>
          ) : null}
          <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Bank Transfer</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <CopyRow label="Bank name" value={details?.bankName || ''} />
              <CopyRow label="Account number" value={details?.bankAccountNumber || ''} />
              <CopyRow label="Account name" value={details?.bankAccountName || ''} />
            </div>
          </div>
        </div>
        {details?.paymentInstructions?.trim() ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-900 whitespace-pre-wrap">
            {details.paymentInstructions}
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="rounded-2xl border border-emerald-200 bg-white p-4 space-y-4 shadow-sm">
        <h3 className="text-sm font-bold text-gray-800">Submit payment proof</h3>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
          >
            {linkedStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} — {s.admissionNumber}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Exact amount paid (GHS)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="0.00"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Network used</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as (typeof NETWORKS)[number])}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
            >
              {NETWORKS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Transaction reference (optional)</label>
          <input
            type="text"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="MoMo / bank reference number"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700">Screenshot (max 5MB, images only)</label>
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 cursor-pointer hover:bg-slate-100 transition-colors">
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="text-xs text-slate-600">{screenshot ? screenshot.name : 'Tap to upload screenshot'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0] || null)}
            />
          </label>
          {previewUrl ? (
            <button
              type="button"
              onClick={() => setImagePreview({
                url: previewUrl,
                title: 'Payment proof preview',
                subtitle: 'Tap outside or close to return',
              })}
              className="mt-2 block w-full max-w-xs rounded-lg border overflow-hidden hover:ring-2 ring-emerald-400 transition-shadow"
            >
              <img src={previewUrl} alt="Preview" className="max-h-40 w-full object-contain bg-slate-50" />
              <span className="flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50">
                <Eye className="h-3.5 w-3.5" /> Tap to view full size
              </span>
            </button>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit Payment Proof'}
        </button>
      </form>

      <div className="space-y-3">
        <h3 className="text-sm font-bold text-gray-800">Your submissions</h3>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500 rounded-xl border border-dashed border-slate-200 p-4 text-center">
            No payment submissions yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    GHS {Number(row.amountClaimed).toLocaleString('en-GH', { minimumFractionDigits: 2 })}
                    <span className="text-slate-500 font-normal"> · {row.networkUsed}</span>
                  </p>
                  <p className="text-xs text-slate-500">{formatDisplayDateTime(row.submittedAt)}</p>
                  {row.studentName ? <p className="text-xs text-slate-600">{row.studentName}</p> : null}
                  {row.status === 'rejected' && row.notes ? (
                    <p className="text-xs text-red-700 mt-1">{row.notes}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {row.screenshotUrl ? (
                    <button
                      type="button"
                      disabled={proofLoadingId === row.id}
                      onClick={() => void openProofPreview(row)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      {proofLoadingId === row.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}{' '}
                      View
                    </button>
                  ) : null}
                  <StatusBadge status={row.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <ParentOnlinePaymentPanel
        token={token}
        linkedStudents={linkedStudents}
        defaultStudentId={defaultStudentId}
        outstandingAmount={outstandingAmount}
        schoolName={schoolName}
        logoUrl={logoUrl}
        onPaymentSuccess={onOnlinePaymentSuccess}
      />

      {onlinePaymentsEnabled ? (
        <Collapsible open={manualOpen} onOpenChange={setManualOpen} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-50/80 transition-colors"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">Manual payment</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                    Bank transfer or MoMo — view school details and submit proof for review
                  </p>
                </div>
              </div>
              <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200', manualOpen && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-5 border-t border-slate-100 px-4 pb-4 pt-4">
            {manualPaymentContent}
          </CollapsibleContent>
        </Collapsible>
      ) : (
        manualPaymentContent
      )}

      <PaymentProofImageDialog
        open={!!imagePreview}
        onOpenChange={closeImagePreview}
        imageUrl={imagePreview?.url ?? null}
        title={imagePreview?.title}
        subtitle={imagePreview?.subtitle}
      />
    </div>
  );
};

export default ParentMakePaymentPanel;
