import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { apiService } from '../../services/api';
import { toast } from '@/hooks/use-toast';
import { formatMoney, MONTH_NAMES } from './payrollUtils';
import { downloadPayrollPayslipPdf, printPayslipHtml, type PayslipInput } from './payrollPayslipPdf';
import { FileDown, Printer, UserPen } from 'lucide-react';

export type PayrollRowSummary = {
  id: number;
  payeeType: string;
  name: string;
  staffId: string | null;
  role: string;
  status: string;
  paidDate?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  month: number;
  year: number;
  row: PayrollRowSummary | null;
  currency: string;
  schoolName: string;
  schoolLogo?: string | null;
  onSaved: () => void;
  onEditProfile: (row: PayrollRowSummary) => void;
};

type DetailResponse = {
  settings: {
    defaultSsnitPercent: number;
    currency: string;
    payslipFooterText: string;
    payslipSignatureText: string;
  };
  staff: {
    payeeType: string;
    name: string;
    staffId: string | null;
    position: string;
    monthlySalary: number;
    ssnitEnabled: boolean;
  };
  line: {
    grossSalary: number;
    ssnitPercent: number;
    ssnitAmount: number;
    ssnitManualAmount: number | null;
    otherDeductions: number;
    allowances: number;
    netSalary: number;
    payrollNotes: string;
    paymentNotes: string;
    amountPaid: number;
    paidDate: string | null;
    paymentMethod: string | null;
    expenseId: number | null;
    stored: boolean;
  };
  paymentHistory: Array<{
    month: number;
    year: number;
    amountPaid: number;
    grossSalary: number | null;
    netSalary: number | null;
    ssnitAmount: number | null;
    paidDate: string | null;
    paymentMethod: string | null;
    notes: string | null;
    expenseId: number | null;
  }>;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function previewLine(gross: number, ssnitPct: number, ssnitOn: boolean, otherD: number, allow: number) {
  const ssnit = ssnitOn ? round2(gross * (ssnitPct / 100)) : 0;
  const net = round2(gross - ssnit - round2(otherD) + round2(allow));
  return { ssnit, net };
}

const PayrollDetailModal: React.FC<Props> = ({
  open,
  onOpenChange,
  month,
  year,
  row,
  currency,
  schoolName,
  schoolLogo,
  onSaved,
  onEditProfile,
}) => {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [grossStr, setGrossStr] = useState('');
  const [otherDed, setOtherDed] = useState('');
  const [allowances, setAllowances] = useState('');
  const [notes, setNotes] = useState('');
  const [ssnitOn, setSsnitOn] = useState(true);
  const [ssnitManualStr, setSsnitManualStr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !row) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = new URLSearchParams({
          month: String(month),
          year: String(year),
          payee_type: row.payeeType,
          payee_id: String(row.id),
        });
        const res = await apiService.get<DetailResponse>(`/payroll/detail?${q}`);
        if (cancelled) return;
        setDetail(res);
        const g = res.line.grossSalary ?? res.staff.monthlySalary;
        setGrossStr(String(g ?? 0));
        setOtherDed(String(res.line.otherDeductions ?? 0));
        setAllowances(String(res.line.allowances ?? 0));
        setNotes(res.line.payrollNotes || '');
        setSsnitOn(res.staff.ssnitEnabled !== false);
        setSsnitManualStr(
          res.line.ssnitManualAmount != null && res.staff.ssnitEnabled === false
            ? String(res.line.ssnitManualAmount)
            : ''
        );
      } catch (e: any) {
        if (!cancelled) toast({ title: 'Error', description: e?.message || 'Failed to load', variant: 'destructive' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, row, month, year]);

  const preview = useMemo(() => {
    if (!detail) return null;
    const g = parseFloat(grossStr);
    const gross = Number.isFinite(g) && g >= 0 ? g : detail.line.grossSalary;
    const od = Math.max(0, parseFloat(otherDed || '0') || 0);
    const al = Math.max(0, parseFloat(allowances || '0') || 0);
    const pct = detail.line.ssnitPercent;
    const { ssnit, net } = previewLine(gross, pct, ssnitOn, od, al);
    return { gross, ssnit, net, pct };
  }, [detail, grossStr, otherDed, allowances, ssnitOn]);

  const saveLine = async () => {
    if (!row) return;
    setSaving(true);
    try {
      const g = parseFloat(grossStr);
      const manualTrim = ssnitManualStr.trim();
      const manualPayload =
        !ssnitOn && manualTrim !== ''
          ? parseFloat(manualTrim)
          : null;
      await apiService.patch('/payroll/line', {
        payee_type: row.payeeType,
        payee_id: row.id,
        month,
        year,
        gross_salary: Number.isFinite(g) && g >= 0 ? g : undefined,
        other_deductions: parseFloat(otherDed || '0'),
        allowances: parseFloat(allowances || '0'),
        payroll_notes: notes,
        ssnit_manual_amount: manualPayload,
      });
      toast({ title: 'Saved', description: 'Payroll line updated.' });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleSsnit = async (enabled: boolean) => {
    if (!row) return;
    try {
      await apiService.patch(`/payroll/staff/${row.payeeType}/${row.id}`, { ssnit_enabled: enabled });
      setSsnitOn(enabled);
      if (enabled) {
        setSsnitManualStr('');
        await apiService.patch('/payroll/line', {
          payee_type: row.payeeType,
          payee_id: row.id,
          month,
          year,
          ssnit_manual_amount: null,
        });
      }
      toast({ title: 'Updated', description: enabled ? 'SSNIT applies to this staff member.' : 'SSNIT disabled for this staff member.' });
      onSaved();
      const q = new URLSearchParams({
        month: String(month),
        year: String(year),
        payee_type: row.payeeType,
        payee_id: String(row.id),
      });
      const res = await apiService.get<DetailResponse>(`/payroll/detail?${q}`);
      setDetail(res);
      setSsnitManualStr(
        res.line.ssnitManualAmount != null && res.staff.ssnitEnabled === false
          ? String(res.line.ssnitManualAmount)
          : ''
      );
    } catch (e: any) {
      toast({ title: 'Error', description: e?.message || 'Update failed', variant: 'destructive' });
    }
  };

  const payslipData = (): PayslipInput | null => {
    if (!detail || !row || !preview) return null;
    const manualAmt =
      !ssnitOn && ssnitManualStr.trim() !== ''
        ? Math.max(0, parseFloat(ssnitManualStr) || 0)
        : detail.line.ssnitManualAmount;
    return {
      schoolName,
      logoDataUrl: schoolLogo || undefined,
      staffName: detail.staff.name,
      staffId: detail.staff.staffId,
      position: detail.staff.position,
      month,
      year,
      currency: detail.settings.currency || currency,
      grossSalary: preview.gross,
      ssnitEnabled: ssnitOn,
      ssnitAmount: preview.ssnit,
      ssnitManualAmount: manualAmt != null && manualAmt > 0 ? manualAmt : null,
      otherDeductions: parseFloat(otherDed || '0') || 0,
      allowances: parseFloat(allowances || '0') || 0,
      netSalary: preview.net,
      status: row.status,
      paidDate: detail.line.paidDate || row.paidDate || null,
      footerText: detail.settings.payslipFooterText || '',
      signatureText: detail.settings.payslipSignatureText || 'Authorized signatory',
    };
  };

  const handlePdf = () => {
    const d = payslipData();
    if (!d) return;
    const safe = d.staffName.replace(/[^\w\-]+/g, '_').slice(0, 40);
    downloadPayrollPayslipPdf(d, `payslip-${safe}-${month}-${year}.pdf`);
  };

  const handlePrint = () => {
    const d = payslipData();
    if (!d) return;
    printPayslipHtml(d);
  };

  const fullyPaid =
    detail &&
    detail.line.netSalary > 0 &&
    detail.line.amountPaid >= detail.line.netSalary - 0.01;

  const cur = detail?.settings.currency || currency;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,720px)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="shrink-0 border-b border-border px-6 pt-6 pb-3 pr-12 text-left">
          <DialogTitle className="text-lg">Payroll details</DialogTitle>
          {row && (
            <p className="text-sm text-muted-foreground font-normal">
              {row.name} · {MONTH_NAMES[month - 1]} {year}
            </p>
          )}
        </DialogHeader>

        {loading || !detail ? (
          <div className="flex-1 overflow-y-auto px-6 py-12 text-center text-muted-foreground text-sm">{loading ? 'Loading…' : 'No data'}</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
              <div className="space-y-4 pb-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Staff ID</span>
                    <span className="font-mono">{detail.staff.staffId || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Position</span>
                    <span>{detail.staff.position}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Contract monthly</span>
                    <span className="font-medium">{formatMoney(cur, detail.staff.monthlySalary)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">Enable SSNIT</p>
                    <p className="text-xs text-muted-foreground">Uses default % on gross for this month</p>
                  </div>
                  <Switch
                    checked={ssnitOn}
                    onCheckedChange={(v) => toggleSsnit(v)}
                    disabled={!!fullyPaid}
                    className="data-[state=checked]:!bg-emerald-500 data-[state=unchecked]:!bg-red-500"
                  />
                </div>

                {!ssnitOn && (
                  <div>
                    <Label>SSNIT amount (record only) ({cur})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      className="mt-1"
                      value={ssnitManualStr}
                      onChange={(e) => setSsnitManualStr(e.target.value)}
                      disabled={!!fullyPaid}
                      placeholder="Enter SSNIT amount for records"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This will not be deducted from salary. For records only.
                    </p>
                  </div>
                )}

                <Separator />

                <div>
                  <Label>Gross salary — this month ({cur})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="mt-1"
                    value={grossStr}
                    onChange={(e) => setGrossStr(e.target.value)}
                    disabled={!!fullyPaid}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Overrides contract for this month only (bonuses, adjustments). Payslip uses this value.
                  </p>
                </div>

                {preview && (
                  <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">SSNIT ({preview.pct}%)</p>
                      <p className="font-semibold">{formatMoney(cur, preview.ssnit)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Net (preview)</p>
                      <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatMoney(cur, preview.net)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Paid to date</p>
                      <p className="font-semibold">{formatMoney(cur, detail.line.amountPaid)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <p className="font-medium">{row?.status}</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label>Other deductions ({cur})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1"
                      value={otherDed}
                      onChange={(e) => setOtherDed(e.target.value)}
                      disabled={!!fullyPaid}
                    />
                  </div>
                  <div>
                    <Label>Allowances ({cur})</Label>
                    <Input
                      type="number"
                      step="0.01"
                      className="mt-1"
                      value={allowances}
                      onChange={(e) => setAllowances(e.target.value)}
                      disabled={!!fullyPaid}
                    />
                  </div>
                  <div>
                    <Label>Payroll notes</Label>
                    <Input className="mt-1" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!!fullyPaid} placeholder="Internal notes" />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Payment history</p>
                  <div className="rounded-md border border-border divide-y divide-border max-h-40 overflow-y-auto text-xs">
                    {detail.paymentHistory.length === 0 ? (
                      <div className="p-3 text-muted-foreground">No records yet</div>
                    ) : (
                      detail.paymentHistory.map((h, i) => (
                        <div key={i} className="p-2 flex justify-between gap-2">
                          <span>
                            {MONTH_NAMES[h.month - 1]} {h.year}
                          </span>
                          <span className="font-mono">{formatMoney(cur, h.amountPaid)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-1" />
                    Print payslip
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handlePdf}>
                    <FileDown className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                  {row && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => row && onEditProfile(row)}>
                      <UserPen className="w-4 h-4 mr-1" />
                      Edit profile / contract salary
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={saveLine} disabled={saving || !!fullyPaid} className="bg-slate-800 hover:bg-slate-700">
                {fullyPaid ? 'Locked (paid)' : saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PayrollDetailModal;
