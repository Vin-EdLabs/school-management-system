import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PaystackPop from '@paystack/inline-js';
import { CheckCircle2, CreditCard, Loader2, XCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { BrandedLoading } from '@/components/common/BrandedLoading';
import {
  fetchParentOnlineConfig,
  initializeParentPayment,
  verifyParentPayment,
  type OnlinePaymentReceipt,
  type PaystackConfigPublic,
} from '@/services/onlinePaymentApi';
import { formatGhs } from '@/utils/currency';

interface LinkedStudent {
  id: number;
  firstName: string;
  lastName: string;
  admissionNumber: string;
}

type PayPhase = 'idle' | 'processing' | 'success' | 'failed';

export default function ParentOnlinePaymentPanel({
  token,
  linkedStudents,
  defaultStudentId,
  outstandingAmount,
  schoolName,
  logoUrl,
  onPaymentSuccess,
}: {
  token: string;
  linkedStudents: LinkedStudent[];
  defaultStudentId?: number;
  outstandingAmount?: number;
  schoolName?: string;
  logoUrl?: string | null;
  onPaymentSuccess?: (payment: OnlinePaymentReceipt) => void | Promise<void>;
}) {
  const [config, setConfig] = useState<PaystackConfigPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState(String(defaultStudentId || linkedStudents[0]?.id || ''));
  const [amount, setAmount] = useState('');
  const [phase, setPhase] = useState<PayPhase>('idle');
  const [result, setResult] = useState<{
    reference: string;
    amountGhs: number;
    feeGhs: number;
    totalGhs: number;
    receiptNumber?: string;
  } | null>(null);
  const [paying, setPaying] = useState(false);
  const paystackRef = useRef<PaystackPop | null>(null);

  const selectedStudent = useMemo(
    () => linkedStudents.find((s) => String(s.id) === studentId),
    [linkedStudents, studentId]
  );

  const loadConfig = useCallback(async () => {
    try {
      const c = await fetchParentOnlineConfig(token);
      setConfig(c);
    } catch {
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (defaultStudentId) setStudentId(String(defaultStudentId));
  }, [defaultStudentId]);

  useEffect(() => {
    if (outstandingAmount != null && outstandingAmount > 0 && !amount) {
      setAmount(String(Math.max(outstandingAmount, 0).toFixed(2)));
    }
  }, [outstandingAmount, amount]);

  const finalizePayment = useCallback(
    async (reference: string) => {
      setPhase('processing');
      try {
        const verified = await verifyParentPayment(token, reference);
        if (verified.status === 'success') {
          setPhase('success');
          setResult({
            reference: verified.reference,
            amountGhs: verified.amountGhs,
            feeGhs: verified.feeGhs,
            totalGhs: verified.totalGhs,
            receiptNumber: verified.payment?.receipt_number,
          });
          if (verified.payment) {
            await onPaymentSuccess?.(verified.payment);
          }
        } else {
          setPhase('failed');
          setResult({
            reference: verified.reference,
            amountGhs: verified.amountGhs,
            feeGhs: verified.feeGhs,
            totalGhs: verified.totalGhs,
          });
        }
      } catch (e: unknown) {
        setPhase('failed');
        toast({
          title: 'Payment verification failed',
          description: (e as Error).message,
          variant: 'destructive',
        });
      } finally {
        setPaying(false);
      }
    },
    [onPaymentSuccess, token]
  );

  const feePreview = useMemo(() => {
    const base = parseFloat(amount);
    if (!Number.isFinite(base) || base <= 0) return null;
    const schoolPaysFee = config?.feeBearer === 'school';
    const fee = Math.ceil(base * 100 * 0.0195) / 100;
    return {
      base,
      fee,
      total: schoolPaysFee ? base : Math.round((base + fee) * 100) / 100,
      schoolPaysFee,
    };
  }, [amount, config?.feeBearer]);

  const handlePay = async () => {
    const parsed = parseFloat(amount);
    if (!studentId || !Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: 'Enter a valid amount', variant: 'destructive' });
      return;
    }
    if (!config?.publicKey) {
      toast({ title: 'Online payment unavailable', description: 'Paystack is not configured for this school.', variant: 'destructive' });
      return;
    }

    setPaying(true);
    try {
      const init = await initializeParentPayment(token, {
        studentId: parseInt(studentId, 10),
        amount: parsed,
      });

      if (!init.publicKey || !init.access_code) {
        throw new Error('Could not start Paystack checkout');
      }

      if (!paystackRef.current) {
        paystackRef.current = new PaystackPop();
      }

      paystackRef.current.resumeTransaction(init.access_code, {
        onSuccess: (transaction) => {
          void finalizePayment(transaction.reference || init.reference);
        },
        onCancel: () => {
          setPaying(false);
        },
        onError: (error) => {
          setPaying(false);
          toast({
            title: 'Payment could not open',
            description: error?.message || 'Please try again.',
            variant: 'destructive',
          });
        },
      });
    } catch (e: unknown) {
      toast({ title: 'Could not start payment', description: (e as Error).message, variant: 'destructive' });
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <BrandedLoading logoUrl={logoUrl} label="Checking online payments…" />
      </div>
    );
  }

  if (!config?.enabled) return null;

  if (phase === 'success' && result) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-6 text-center shadow-sm" role="alert">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#16a34a]" />
        <h3 className="mt-3 text-lg font-bold text-slate-900">Payment successful</h3>
        <p className="mt-2 text-sm font-semibold text-emerald-800">
          {formatGhs(result.amountGhs)} received — your child&apos;s balance has been updated.
        </p>
        {result.receiptNumber ? (
          <p className="mt-1 text-sm text-slate-700">Receipt: <span className="font-mono font-semibold">{result.receiptNumber}</span></p>
        ) : null}
        <p className="mt-1 font-mono text-xs text-slate-500">Reference: {result.reference}</p>
        <p className="mt-3 text-xs text-slate-600">Your receipt has been saved. Open it anytime from Payment history.</p>
        <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setPhase('idle'); setResult(null); }}>
          Make another payment
        </Button>
      </div>
    );
  }

  if (phase === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm">
        <XCircle className="mx-auto h-12 w-12 text-[#dc2626]" />
        <h3 className="mt-3 text-lg font-bold text-slate-900">Payment not completed</h3>
        <p className="mt-2 text-sm text-slate-600">Your payment was not successful. You can try again.</p>
        <Button className="mt-5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setPhase('idle')}>
          Try again
        </Button>
      </div>
    );
  }

  if (phase === 'processing') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
        <p className="mt-3 text-sm font-medium text-slate-700">Confirming your payment and updating balance…</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="" className="h-12 w-12 rounded-xl border border-slate-100 object-contain bg-white p-1" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <CreditCard className="h-6 w-6" />
          </div>
        )}
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Pay online</p>
          <h3 className="text-base font-bold text-slate-900">{schoolName || 'School fees'}</h3>
          {selectedStudent ? (
            <p className="text-sm text-slate-600">{selectedStudent.firstName} {selectedStudent.lastName} · {selectedStudent.admissionNumber}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-700">Student</label>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white"
          >
            {linkedStudents.map((s) => (
              <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.admissionNumber})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700">Amount (GHS)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            placeholder="0.00"
          />
        </div>
      </div>

      {feePreview ? (
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm space-y-2">
          <div className="flex justify-between"><span className="text-slate-600">School fee</span><span className="font-semibold">{formatGhs(feePreview.base)}</span></div>
          {feePreview.schoolPaysFee ? (
            <p className="text-xs text-slate-500">Processing fee is covered by the school — you pay only the school fee amount.</p>
          ) : (
            <div className="flex justify-between"><span className="text-slate-600">Paystack processing fee</span><span className="font-semibold">{formatGhs(feePreview.fee)}</span></div>
          )}
          <div className="border-t border-slate-200 pt-2 flex justify-between">
            <span className="font-bold text-slate-900">Total to pay</span>
            <span className="font-black text-emerald-700">{formatGhs(feePreview.total)}</span>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        disabled={paying}
        onClick={() => void handlePay()}
        className="w-full bg-emerald-600 py-6 text-base font-bold hover:bg-emerald-700"
      >
        {paying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Paystack…</> : 'Pay now'}
      </Button>
      <p className="text-center text-[11px] text-slate-500">Secure payment via MoMo, card, or bank — stays on this page</p>
    </div>
  );
}
