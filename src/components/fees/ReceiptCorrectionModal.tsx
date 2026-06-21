import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  detailDialogBodyClass,
  detailDialogContentWideClass,
  detailDialogFooterClass,
  detailDialogHeaderClass,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Loader2 } from 'lucide-react';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import LazyStudentAvatar from '../students/LazyStudentAvatar';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { formatDisplayDate } from '../../utils/dateFormat';
import type { Payment } from '../../contexts/DataContext';
import { cn } from '@/lib/utils';
import {
  buildCorrectionPreviewCopy,
  getCurrentBalanceDisplay,
  projectBalanceAfterCorrection,
  validateCorrectionTypeAmount,
} from '../../utils/receiptCorrectionBalance';

type CorrectionContext = {
  eligibility: { canCorrect: boolean; reason?: string; daysLeft?: number };
  rootCreatedAt?: string;
  correctionHistory?: {
    correctionCount: number;
    chain: Array<{ receiptNumber: string; amount: number; isVoided: boolean }>;
  };
  student: {
    id: number;
    firstName: string;
    lastName: string;
    studentId: string;
    admissionNumber?: string;
    className: string;
    hasPassportPhoto?: boolean;
  };
  original: {
    receiptNumber: string;
    amount: number;
    paymentDate: string;
    accountLabel: string;
    paymentMethod: string;
    paymentAccountId?: number | null;
    term?: string;
  };
  balance: {
    totalDue: number;
    totalPaid: number;
    outstanding: number;
    credit: number;
    maxPaymentAmount: number;
  };
};

type ReceiptCorrectionModalProps = {
  open: boolean;
  onClose: () => void;
  payment: Payment | null;
  onCorrected: (message?: string) => void;
};

const ReceiptCorrectionModal: React.FC<ReceiptCorrectionModalProps> = ({
  open,
  onClose,
  payment,
  onCorrected,
}) => {
  const [context, setContext] = useState<CorrectionContext | null>(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [correctionType, setCorrectionType] = useState<'debit' | 'credit'>('credit');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!payment || !open) {
      setContext(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingContext(true);
      try {
        const data = await apiService.get<CorrectionContext>(`/payments/${payment.id}/correction-context`);
        if (cancelled) return;
        setContext(data);
        setAmount(String(data.original.amount));
        setPaymentDate(String(data.original.paymentDate || payment.date).split('T')[0]);
        setPaymentAccountId(
          data.original.paymentAccountId != null ? String(data.original.paymentAccountId) : payment.paymentAccountId || ''
        );
        setPaymentMethod(data.original.paymentMethod || payment.paymentMethod || 'Cash');
        setCorrectionType('credit');
        setReason('');
      } catch (err: any) {
        if (!cancelled) {
          toast({
            title: 'Cannot open correction',
            description: err?.response?.data?.error || err?.message || 'Failed to load receipt details',
            variant: 'destructive',
          });
          onClose();
        }
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payment, open, onClose]);

  const parsedAmount = parseFloat(amount);
  const originalAmount = context?.original.amount ?? payment?.amount ?? 0;
  const maxAmount = context?.balance.maxPaymentAmount ?? 0;

  const projected = useMemo(() => {
    if (!context || Number.isNaN(parsedAmount) || parsedAmount <= 0) return null;
    return projectBalanceAfterCorrection(
      context.balance.outstanding,
      context.balance.credit,
      originalAmount,
      parsedAmount,
      correctionType
    );
  }, [context, parsedAmount, originalAmount, correctionType]);

  const previewCopy = useMemo(() => {
    if (!context || !projected) return null;
    return buildCorrectionPreviewCopy(
      correctionType,
      context.balance.outstanding,
      context.balance.credit,
      projected
    );
  }, [context, projected, correctionType]);

  const currentBalance = useMemo(() => {
    if (!context) return null;
    return getCurrentBalanceDisplay(
      context.balance.outstanding,
      context.balance.credit,
      context.balance.totalDue
    );
  }, [context]);

  const typeAmountError = useMemo(() => {
    if (!context || Number.isNaN(parsedAmount) || parsedAmount <= 0) return '';
    return validateCorrectionTypeAmount(correctionType, originalAmount, parsedAmount) || '';
  }, [context, parsedAmount, originalAmount, correctionType]);

  const amountError = useMemo(() => {
    if (!amount.trim()) return 'Enter a valid amount';
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) return 'Amount must be greater than zero';
    if (maxAmount > 0 && parsedAmount > maxAmount + 0.0001) {
      return `Amount cannot exceed total term fee (GHS ${maxAmount.toLocaleString()})`;
    }
    return typeAmountError;
  }, [amount, parsedAmount, maxAmount, typeAmountError]);

  const canSubmit =
    !!context?.eligibility.canCorrect &&
    !amountError &&
    reason.trim().length > 0 &&
    paymentDate.trim().length > 0 &&
    !saving;

  const handleSubmit = async () => {
    if (!payment || !context || !canSubmit) return;
    try {
      setSaving(true);
      const res = await apiService.post<{ message?: string; corrected?: { receipt_number?: string } }>(
        `/payments/${payment.id}/correct`,
        {
          amount: parsedAmount,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          payment_account_id: paymentAccountId ? parseInt(paymentAccountId, 10) : undefined,
          student_id: context.student.id,
          reason: reason.trim(),
          correction_type: correctionType,
          term: context.original.term || payment.term,
          notes: payment.notes,
        }
      );
      toast({
        title: 'Receipt corrected',
        description:
          res.message ||
          `Receipt ${context.original.receiptNumber} has been corrected. New receipt created.`,
      });
      onCorrected(res.message);
      onClose();
    } catch (err: any) {
      toast({
        title: 'Correction failed',
        description: err?.response?.data?.error || err?.message || 'Could not correct receipt',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!payment) return null;

  const studentName = context
    ? `${context.student.firstName} ${context.student.lastName}`.trim()
    : 'Student';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className={cn(detailDialogContentWideClass, 'sm:max-w-2xl')}>
        <DialogHeader className={detailDialogHeaderClass}>
          <DialogTitle>Correct receipt #{context?.original.receiptNumber || payment.receiptNumber}</DialogTitle>
        </DialogHeader>

        <DialogBody className={cn(detailDialogBodyClass, 'space-y-6')}>
        {loadingContext ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading receipt details…
          </div>
        ) : context && !context.eligibility.canCorrect ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {context.eligibility.reason || 'This receipt cannot be corrected.'}
          </div>
        ) : context ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p>
                  The original receipt will be voided permanently. A corrected receipt (e.g.{' '}
                  {context.original.receiptNumber}-R1) will replace it. This is logged in the audit trail.
                </p>
              </div>
            </div>

            {/* Student — read only */}
            <section className="rounded-xl border bg-muted/20 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</h3>
              <div className="flex items-start gap-4">
                <LazyStudentAvatar
                  studentId={String(context.student.id)}
                  firstName={context.student.firstName}
                  lastName={context.student.lastName}
                  hasPassportPhoto={context.student.hasPassportPhoto}
                  className="h-14 w-14"
                  eager
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-lg font-semibold text-foreground">{studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    ID: {context.student.studentId}
                    {context.student.admissionNumber ? ` · Adm: ${context.student.admissionNumber}` : ''}
                  </p>
                  <p className="text-sm text-muted-foreground">Class: {context.student.className}</p>
                  {currentBalance && (
                    <p
                      className={cn(
                        'text-sm font-semibold',
                        currentBalance.kind === 'overpayment'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      )}
                    >
                      {currentBalance.label}: {currentBalance.formatted}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Original receipt — read only */}
            <section className="rounded-xl border bg-muted/10 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Original receipt
              </h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Receipt number</dt>
                  <dd className="font-mono font-medium">{context.original.receiptNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{formatDisplayDate(context.original.paymentDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-muted-foreground line-through">
                    GHS {context.original.amount.toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Payment account</dt>
                  <dd className="text-muted-foreground">{context.original.accountLabel}</dd>
                </div>
              </dl>
            </section>

            {/* Correction fields */}
            <section className="space-y-4 rounded-xl border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correction details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="corr-amount">New amount (GHS)</Label>
                  <Input
                    id="corr-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  {amountError && <p className="text-xs text-destructive">{amountError}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="corr-date">New payment date</Label>
                  <Input
                    id="corr-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                  />
                </div>
              </div>
              <PaymentAccountSelect
                value={paymentAccountId}
                onChange={(accountId, method) => {
                  setPaymentAccountId(accountId);
                  setPaymentMethod(method);
                }}
                label="New payment account"
              />
              <div className="space-y-2">
                <Label>Correction type</Label>
                <RadioGroup
                  value={correctionType}
                  onValueChange={(v) => setCorrectionType(v as 'debit' | 'credit')}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <label
                    className={cn(
                      'flex cursor-pointer gap-2 rounded-lg border p-3 text-sm',
                      correctionType === 'debit' && 'border-amber-500 bg-amber-500/10'
                    )}
                  >
                    <RadioGroupItem value="debit" id="type-debit" className="mt-0.5" />
                    <div>
                      <span className="font-medium">Debit</span>
                      <p className="text-xs text-muted-foreground">
                        Lower amount — outstanding balance increases (payment was recorded too high)
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      'flex cursor-pointer gap-2 rounded-lg border p-3 text-sm',
                      correctionType === 'credit' && 'border-emerald-500 bg-emerald-500/10'
                    )}
                  >
                    <RadioGroupItem value="credit" id="type-credit" className="mt-0.5" />
                    <div>
                      <span className="font-medium">Credit</span>
                      <p className="text-xs text-muted-foreground">
                        Higher amount — clears more of the student&apos;s balance
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
              <div className="space-y-2">
                <Label htmlFor="corr-reason">Reason for correction *</Label>
                <Textarea
                  id="corr-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this receipt is being corrected…"
                  rows={3}
                />
              </div>
            </section>

            {context.correctionHistory && context.correctionHistory.correctionCount > 0 && (
              <div className="rounded-lg border border-border/70 bg-muted/15 px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  This receipt has been corrected {context.correctionHistory.correctionCount}{' '}
                  {context.correctionHistory.correctionCount === 1 ? 'time' : 'times'}.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Chain:{' '}
                  {context.correctionHistory.chain.map((c) => c.receiptNumber).join(' → ')}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  7-day window from original receipt ({formatDisplayDate(context.rootCreatedAt || '')})
                </p>
              </div>
            )}

            {/* Preview */}
            {previewCopy && projected && !amountError && (
              <section className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
                <h3 className="mb-2 text-sm font-semibold text-foreground">
                  After this {correctionType === 'debit' ? 'debit' : 'credit'} correction
                </h3>
                {previewCopy.headline && (
                  <p
                    className={cn(
                      'mb-2 text-sm font-medium',
                      correctionType === 'credit'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-amber-800 dark:text-amber-200'
                    )}
                  >
                    {previewCopy.headline}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">{previewCopy.balanceLine}</p>
                {previewCopy.extraLine && (
                  <p
                    className={cn(
                      'mt-2 text-sm font-medium',
                      correctionType === 'credit'
                        ? 'text-emerald-700 dark:text-emerald-300'
                        : 'text-foreground'
                    )}
                  >
                    {previewCopy.extraLine}
                  </p>
                )}
              </section>
            )}
          </div>
        ) : null}
        </DialogBody>

        <DialogFooter className={detailDialogFooterClass}>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Confirm correction'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptCorrectionModal;
