import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { formatAdjustmentGhs, formatGhs } from '../../utils/currency';
import { CalendarRange, Loader2, Lock, ShieldCheck } from 'lucide-react';

export const OVERRIDE_REASON_KEYS = [
  'wrong_arrears',
  'payment_not_captured',
  'fee_waiver',
  'system_error',
  'other',
] as const;

const REASON_LABELS: Record<(typeof OVERRIDE_REASON_KEYS)[number], string> = {
  wrong_arrears: 'Wrong arrears added by system',
  payment_not_captured: 'Payment not captured',
  fee_waiver: 'Fee waiver',
  system_error: 'System error correction',
  other: 'Other',
};

/** Same logic as Fee status / class report (Set Fees + arrears balances + term payments). */
export type FeeBreakdownForOverride = {
  termFee: number;
  arrears: number;
  totalDue: number;
  paid: number;
  /** totalDue − paid (negative = credit). */
  balance: number;
};

export type ManualBalanceOverrideDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  /** Cumulative ledger balance (debit − credit); server uses this for the adjustment. */
  ledgerBalance: number;
  /** When set, mirrors the fee status table (term fee, arrears, total, paid, balance). */
  feeBreakdown: FeeBreakdownForOverride | null;
  /** Human-readable active period, e.g. "First Term · 2024/2025". */
  activePeriodLabel: string;
  /** When false, override cannot be applied until Settings has current term/year. */
  activePeriodConfigured: boolean;
  onSuccess: () => void;
};

const ManualBalanceOverrideDialog: React.FC<ManualBalanceOverrideDialogProps> = ({
  open,
  onOpenChange,
  studentId,
  studentName,
  ledgerBalance,
  feeBreakdown,
  activePeriodLabel,
  activePeriodConfigured,
  onSuccess,
}) => {
  const [newBalanceStr, setNewBalanceStr] = useState('');
  const [reasonKey, setReasonKey] = useState<(typeof OVERRIDE_REASON_KEYS)[number]>('wrong_arrears');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const newBalanceNum = useMemo(() => {
    const t = newBalanceStr.trim();
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }, [newBalanceStr]);

  const adjustment = useMemo(() => {
    if (newBalanceNum == null) return null;
    return Math.round((newBalanceNum - ledgerBalance) * 100) / 100;
  }, [newBalanceNum, ledgerBalance]);

  const ledgerFeeMismatch = useMemo(() => {
    if (!feeBreakdown) return false;
    return Math.abs(ledgerBalance - feeBreakdown.balance) > 0.02;
  }, [ledgerBalance, feeBreakdown]);

  useEffect(() => {
    if (!open) {
      setNewBalanceStr('');
      setNotes('');
      setFile(null);
      setReasonKey('wrong_arrears');
    }
  }, [open]);

  const submit = async () => {
    if (!activePeriodConfigured) {
      toast({
        title: 'Active term not set',
        description: 'Configure the current term and year in School Settings first.',
        variant: 'destructive',
      });
      return;
    }
    if (newBalanceNum == null) {
      toast({ title: 'New balance required', description: 'Enter the desired ledger balance.', variant: 'destructive' });
      return;
    }
    if (adjustment === 0 || adjustment == null) {
      toast({
        title: 'No change',
        description: 'New balance matches the current ledger balance.',
        variant: 'destructive',
      });
      return;
    }
    if (notes.trim().length < 5) {
      toast({ title: 'Notes required', description: 'Add at least 5 characters of notes.', variant: 'destructive' });
      return;
    }

    const fd = new FormData();
    fd.append('newBalance', String(newBalanceNum));
    fd.append('reasonCategory', reasonKey);
    fd.append('notes', notes.trim());
    if (file) fd.append('document', file);

    setLoading(true);
    try {
      const res = await apiService.postForm<{
        newBalance: number;
        previousBalance: number;
        adjustmentAmount: number;
      }>(`/finance/student/${studentId}/manual-balance-override`, fd);
      toast({
        title: 'Balance updated',
        description: `New ledger balance: ${formatGhs(res.newBalance)} (was ${formatGhs(res.previousBalance)}).`,
      });
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      const msg = e?.message || 'Override failed';
      toast({ title: 'Could not apply override', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-lg gap-0 overflow-hidden border-border/80 p-0 sm:max-w-xl">
        <div className="border-b border-border/60 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-5 text-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <DialogHeader className="space-y-2 text-left">
            <div className="flex items-center gap-2 text-slate-200">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-400" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Audited adjustment</span>
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-white">Manual balance override</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-300">
              {studentName} — append-only ledger entry. Existing lines are never edited.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[calc(92vh-12rem)] space-y-4 overflow-y-auto px-6 py-5">
          {!activePeriodConfigured ? (
            <Alert className="border-amber-600/40 bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-50">
              <CalendarRange className="h-4 w-4" />
              <AlertTitle>Active term required</AlertTitle>
              <AlertDescription>
                Set the current term and academic year in School Settings. Overrides are always tied to that period.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex items-start gap-3 rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] p-3 text-sm dark:bg-emerald-500/10">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <div>
                <p className="font-medium text-foreground">Locked to current term</p>
                <p className="mt-0.5 text-muted-foreground">
                  This adjustment is recorded for <span className="font-medium text-foreground">{activePeriodLabel}</span> only.
                </p>
              </div>
            </div>
          )}

          {feeBreakdown && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current term (fees &amp; payments)</p>
              <p className="text-[11px] text-muted-foreground">Same columns as the fee status / class report.</p>
              <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
                <table className="w-full min-w-[520px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-right">Total Term Bill</th>
                      <th className="px-3 py-2 text-right">Arrears</th>
                      <th className="px-3 py-2 text-right">Total due</th>
                      <th className="px-3 py-2 text-right">Paid</th>
                      <th className="px-3 py-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">{formatGhs(feeBreakdown.termFee)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-700 dark:text-amber-400">
                        {formatGhs(feeBreakdown.arrears)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold tabular-nums">{formatGhs(feeBreakdown.totalDue)}</td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                        {formatGhs(feeBreakdown.paid)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-mono font-semibold tabular-nums ${
                          feeBreakdown.balance > 0
                            ? 'text-red-600 dark:text-red-400'
                            : feeBreakdown.balance < 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : ''
                        }`}
                      >
                        {formatGhs(feeBreakdown.balance)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {ledgerFeeMismatch && feeBreakdown && (
            <Alert className="border-amber-500/40 bg-amber-50 text-amber-950 dark:bg-amber-950/25 dark:text-amber-50">
              <AlertTitle>Ledger vs fee balance differ</AlertTitle>
              <AlertDescription>
                Fee view balance is <span className="font-mono font-medium">{formatGhs(feeBreakdown.balance)}</span> but the
                ledger shows <span className="font-mono font-medium">{formatGhs(ledgerBalance)}</span>. The override still posts
                to the <span className="font-medium">ledger</span> — set &quot;New ledger balance&quot; to the amount you want on
                the official ledger (often aligned with the fee balance after corrections).
              </AlertDescription>
            </Alert>
          )}

          <div className="rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Official ledger balance</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums tracking-tight">{formatGhs(ledgerBalance)}</p>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Cumulative debit − credit. The server compares your new value against this figure to compute the adjustment.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nb">New ledger balance (GH₵)</Label>
            <Input
              id="nb"
              inputMode="decimal"
              className="font-mono tabular-nums"
              placeholder="e.g. 450.00"
              value={newBalanceStr}
              onChange={(e) => setNewBalanceStr(e.target.value)}
            />
          </div>

          {adjustment != null && newBalanceStr.trim() !== '' && (
            <div
              className={`rounded-xl border p-3.5 text-sm font-medium tabular-nums shadow-sm ${
                adjustment < 0
                  ? 'border-emerald-500/35 bg-emerald-500/[0.08] text-emerald-900 dark:text-emerald-100'
                  : adjustment > 0
                    ? 'border-red-500/35 bg-red-500/[0.08] text-red-900 dark:text-red-100'
                    : 'border-muted bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Net adjustment</span>
                <span className="font-mono">{formatAdjustmentGhs(adjustment)}</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Reason</Label>
            <Select value={reasonKey} onValueChange={(v) => setReasonKey(v as (typeof OVERRIDE_REASON_KEYS)[number])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OVERRIDE_REASON_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {REASON_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes for audit trail (required)</Label>
            <Textarea
              id="notes"
              rows={3}
              className="resize-none"
              placeholder="Brief, factual explanation of why the ledger balance is being corrected…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc">Supporting document (optional)</Label>
            <Input id="doc" type="file" accept="image/*,.pdf,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/60 bg-muted/20 px-6 py-4 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            className="min-w-[140px] gap-2 bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            onClick={submit}
            disabled={loading || !activePeriodConfigured}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                Apply override
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualBalanceOverrideDialog;
