
import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { CreditCard, Search, Loader2 } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { parseReceiptSnapshot, resolveReceiptDisplayAmounts } from '../../utils/feeCalculations';
import { useTermReadOnly } from '../../contexts/TermStatusContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { useRecordPayment } from '../../hooks/useRecordPayment';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import { toast } from '@/hooks/use-toast';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import {
  fetchStudentBalance,
  formatBalanceLines,
  type StudentBalance,
} from '../../services/studentBalance';
import {
  fetchFeeStructureItemsSummary,
  formatFeeItemLabel,
  resolveFeeStructureId,
  type FeeStructureItemsSummary,
} from '../../services/feeStructureItems';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type RecordPaymentProps = {
  paymentOpsDisabled?: boolean;
  paymentDisabledReason?: string | null;
  onBlockedSubmit?: () => void;
};

const RecordPayment: React.FC<RecordPaymentProps> = ({
  paymentOpsDisabled = false,
  paymentDisabledReason = null,
  onBlockedSubmit,
}) => {
  const { students, payments, feeStructures, ledgerBalances } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const { readOnly: termReadOnly } = useTermReadOnly();
  const recordPayment = useRecordPayment();

  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentAccountId: '',
    notes: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const [studentBalance, setStudentBalance] = useState<StudentBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [termBillSummary, setTermBillSummary] = useState<FeeStructureItemsSummary | null>(null);
  const [termBillLoading, setTermBillLoading] = useState(false);

  useEffect(() => {
    if (!formData.studentId) {
      setStudentBalance(null);
      return;
    }
    const cached = ledgerBalances[formData.studentId];
    if (cached) {
      setStudentBalance(cached);
    }
    let cancelled = false;
    setBalanceLoading(true);
    void fetchStudentBalance(formData.studentId)
      .then((b) => {
        if (!cancelled) setStudentBalance(b);
      })
      .catch(() => {
        if (!cancelled && !cached) setStudentBalance(null);
      })
      .finally(() => {
        if (!cancelled) setBalanceLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.studentId, payments, ledgerBalances]);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === formData.studentId),
    [students, formData.studentId]
  );

  useEffect(() => {
    if (!formData.studentId || !selectedStudent) {
      setTermBillSummary(null);
      return;
    }
    const feeStructureId = resolveFeeStructureId(
      feeStructures,
      selectedStudent.classAssigned,
      selectedStudent.classId ?? (selectedStudent as { class_id?: number }).class_id,
      currentTerm
    );
    if (!feeStructureId) {
      setTermBillSummary(null);
      return;
    }
    let cancelled = false;
    setTermBillLoading(true);
    void fetchFeeStructureItemsSummary(feeStructureId)
      .then(summary => {
        if (!cancelled) setTermBillSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setTermBillSummary(null);
      })
      .finally(() => {
        if (!cancelled) setTermBillLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formData.studentId, selectedStudent, feeStructures, currentTerm]);

  const activeStudents = useMemo(
    () => students.filter((s) => shouldTrackStudentFees(s)),
    [students]
  );

  const filteredStudents = activeStudents.filter(student =>
    student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId.includes(searchTerm)
  );

  const selectedStudentFeeDetails = useMemo(() => {
    if (!formData.studentId || !currentTerm || currentTerm === 'Not Set') return null;
    if (!studentBalance) return null;
    return {
      currentTermFee: studentBalance.currentTermFee,
      arrears: studentBalance.totalArrears,
      creditBroughtForward: studentBalance.creditBroughtForward ?? 0,
      totalAmountDue: studentBalance.totalDue,
      totalPaid: studentBalance.totalPaid,
      creditBalance: studentBalance.credit,
      individualChargeLines: studentBalance.individualChargeLines ?? [],
      baseFee: studentBalance.currentTermFee,
      discountAmount: 0,
      arrearLines: studentBalance.arrearLines,
      paidLines: studentBalance.paidLines,
    };
  }, [formData.studentId, currentTerm, studentBalance]);

  const breakdownDisplayLines = studentBalance ? formatBalanceLines(studentBalance) : null;

  const outstandingBalance = studentBalance?.outstanding ?? 0;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSubmitting = recordPayment.isPending || termReadOnly;
  const submitDisabled =
    !formData.studentId || !formData.amount || isSubmitting || paymentOpsDisabled;

  const resetForm = () => {
    setFormData({
      studentId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentAccountId: '',
      notes: '',
    });
    setSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentOpsDisabled) {
      onBlockedSubmit?.();
      return;
    }
    if (isSubmitting) return;

    if (!formData.studentId || !formData.amount) {
      toast({ title: 'Validation Error', description: 'Please select a student and enter an amount', variant: 'destructive' });
      return;
    }
    const student = students.find(s => s.id === formData.studentId);
    if (!student) {
      toast({ title: 'Error', description: 'Student not found', variant: 'destructive' });
      return;
    }
    if (!selectedStudentFeeDetails) {
      toast({ title: 'Error', description: 'Could not load fee details. Set fee structure first.', variant: 'destructive' });
      return;
    }

    const paymentAmount = parseFloat(formData.amount);
    const paymentDate = formData.date;
    const paymentMethod = formData.paymentMethod;
    const paymentTerm = currentTerm;
    const paymentNotes = formData.notes;

    const feeDetails = selectedStudentFeeDetails ?? {
      currentTermFee: 0,
      totalAmountDue: 0,
      arrears: 0,
      totalPaid: 0,
    };

    try {
      const result = await recordPayment.mutateAsync({
        studentId: formData.studentId,
        studentIdNum: parseInt(formData.studentId, 10),
        amount: paymentAmount,
        date: paymentDate,
        paymentMethod,
        paymentAccountId: formData.paymentAccountId,
        term: paymentTerm,
        notes: paymentNotes,
        academicYear: currentYear,
      });
      const res = result.res;
      const createdPayment = res.payment || res;
      const serverBalance = res.balance;
      const snap = parseReceiptSnapshot(createdPayment.receipt_snapshot ?? createdPayment.receiptSnapshot);
      const amounts = resolveReceiptDisplayAmounts({
        snap,
        serverBalance,
        feeDetails,
        paymentAmount,
      });

      setReceiptData({
        studentName: `${student.firstName} ${student.lastName}`,
        studentId: student.studentId,
        className: student.classAssigned,
        amount: paymentAmount,
        date: paymentDate,
        paymentMethod,
        term: paymentTerm,
        year: currentYear,
        receiptNumber: createdPayment.receipt_number || createdPayment.receiptNumber || `R${Date.now().toString().slice(-8)}`,
        notes: paymentNotes,
        remainingBalance: snap?.outstandingAfter ?? amounts.remainingBalance,
        creditBalance: snap?.credit ?? amounts.creditBalance,
        arrears: snap?.arrears ?? amounts.arrears,
        currentTermFee: snap?.termFee ?? amounts.currentTermFee,
        totalAmountDue: snap?.totalDue ?? amounts.totalAmountDue,
        arrearsCleared: snap?.arrearsCleared,
        termFeeCleared: snap?.termFeeCleared,
        totalPaidThisTerm: snap?.totalPaidThisTerm,
        paymentStatus: snap?.status,
      });
      setShowReceipt(true);
      resetForm();
    } catch {
      // Error toast handled by useRecordPayment
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur dark:border-border dark:bg-card dark:shadow-sm">
        <CardHeader className="border-b border-slate-100/80 bg-gradient-to-r from-white via-emerald-50/30 to-white px-6 py-5 dark:border-border dark:bg-none">
          <CardTitle className="flex items-start justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-transparent dark:text-card-foreground dark:ring-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-card-foreground">Record Payment</span>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1 border-emerald-100 bg-emerald-50 px-3 py-1 text-emerald-700 dark:border-border dark:bg-transparent dark:text-foreground">
                {currentTerm}
              </Badge>
              <p className="text-sm font-medium text-slate-500 dark:text-muted-foreground">Academic Year: {currentYear}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="readonly-view-allow space-y-2">
              <Label htmlFor="studentSearch" className="font-semibold text-slate-800 dark:text-foreground">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400 dark:top-3 dark:text-muted-foreground" />
                <Input
                  id="studentSearch"
                  placeholder="Search by name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  disabled={isSubmitting}
                />
              </div>
              {searchTerm && (
                <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-950/5 dark:rounded-md dark:border-border dark:bg-card dark:shadow-none">
                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className="cursor-pointer border-b border-slate-100 p-3 transition-colors last:border-b-0 hover:bg-emerald-50/70 dark:border-border dark:hover:bg-muted/50"
                      onClick={() => {
                        if (isSubmitting) return;
                        setFormData(prev => ({...prev, studentId: student.id}));
                        setSearchTerm(`${student.firstName} ${student.lastName} - ${student.studentId}`);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-foreground">{student.firstName} {student.lastName}</p>
                          <p className="text-sm text-slate-500 dark:text-muted-foreground">
                            ID: {student.studentId} | Class: {student.classAssigned}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {formData.studentId && (
              <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-sm dark:rounded-lg dark:border-blue-200 dark:bg-transparent">
                <div className="bg-gradient-to-r from-[#146C43] to-[#22C55E] px-4 py-2 dark:bg-blue-600 dark:bg-none">
                  <h3 className="font-semibold text-white text-sm">
                    {selectedStudent
                      ? `Record Payment — ${selectedStudent.firstName} ${selectedStudent.lastName}`
                      : 'Fee Breakdown'}
                  </h3>
                  <p className="text-white/80 text-xs mt-0.5">
                    {selectedStudent?.classAssigned} · {currentTerm.replace(new RegExp(`\\s+${currentYear}$`), '')} · {currentYear}
                  </p>
                </div>

                {(termBillLoading || termBillSummary) && (
                  <div className="border-b border-emerald-200/80 bg-white/60 px-4 py-3 dark:bg-blue-50/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900/70 mb-2">Term Bill Breakdown</p>
                    {termBillLoading ? (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading bill items…
                      </p>
                    ) : termBillSummary ? (
                      <div className="space-y-1 text-sm">
                        {termBillSummary.items.map(item => (
                          <div key={item.item_name} className="flex justify-between py-0.5">
                            <span className="text-slate-600 dark:text-gray-600">{formatFeeItemLabel(item.item_name)}</span>
                            <span className="font-mono tabular-nums">GHS {Number(item.amount).toFixed(2)}</span>
                          </div>
                        ))}
                        {(studentBalance?.individualChargeLines ?? []).map((charge) => (
                          <div key={charge.id} className="flex justify-between py-0.5 border-t border-dashed border-emerald-100 first:border-t-0">
                            <span className="text-slate-600 dark:text-gray-600 text-xs sm:text-sm">
                              {charge.description}
                              <span className="block text-[10px] text-amber-700 dark:text-amber-500">
                                ⚑ Individual Charge ·{' '}
                                {charge.date
                                  ? new Date(charge.date).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                    })
                                  : '—'}
                              </span>
                            </span>
                            <span className="font-mono tabular-nums">GHS {Number(charge.amount).toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="border-t border-emerald-200 pt-2 mt-2 space-y-1">
                          <div className="flex justify-between font-semibold">
                            <span>
                              {(studentBalance?.individualChargeLines?.length ?? 0) > 0
                                ? 'Total Billed'
                                : 'Total Term Bill'}
                            </span>
                            <span className="font-mono tabular-nums">
                              GHS {(selectedStudentFeeDetails?.totalAmountDue ?? studentBalance?.totalDue ?? termBillSummary.total).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between text-emerald-700 dark:text-green-700">
                            <span>Amount Paid So Far</span>
                            <span className="font-mono tabular-nums">
                              GHS {(selectedStudentFeeDetails?.totalPaid ?? 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between font-semibold text-red-700">
                            <span>Outstanding Balance</span>
                            <span className="font-mono tabular-nums">
                              GHS {(selectedStudentFeeDetails?.totalAmountDue != null
                                ? Math.max(0, selectedStudentFeeDetails.totalAmountDue - (selectedStudentFeeDetails.totalPaid ?? 0))
                                : studentBalance?.outstanding ?? 0
                              ).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {!selectedStudentFeeDetails ? (
                  <div className="p-4 bg-emerald-50/60 text-sm text-slate-500 dark:bg-blue-50 dark:text-gray-500">
                    {balanceLoading ? 'Loading fee breakdown…' : 'No fee structure set for this student\'s class and term.'}
                  </div>
                ) : breakdownDisplayLines ? (
                  <div className="bg-emerald-50/70 px-4 py-3 text-sm dark:bg-blue-50">
                    {breakdownDisplayLines.map((line, i) => (
                      <div
                        key={`${line.label}-${i}`}
                        className={`flex justify-between py-1 ${
                          line.kind === 'total' || line.kind === 'outstanding' ? 'border-t border-emerald-200 pt-2 mt-1 font-semibold dark:border-blue-200' : ''
                        } ${line.kind === 'paid' || line.kind === 'credit' ? 'text-emerald-700 dark:text-green-700' : line.kind === 'outstanding' ? 'text-red-700' : ''}`}
                      >
                        <span>{line.label}</span>
                        <span className="font-mono tabular-nums">
                          {line.kind === 'paid' ? '− ' : line.kind === 'credit' ? '' : ''}GHS {Math.abs(line.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {studentBalance && (studentBalance.netBalance ?? 0) < -0.001 ? (
                      <div className="flex justify-between py-1 text-green-700 border-t border-green-200 mt-1">
                        <span>Credit Balance</span>
                        <span className="font-mono">
                          GHS {(studentBalance.credit > 0 ? studentBalance.credit : Math.abs(studentBalance.netBalance ?? 0)).toFixed(2)}
                        </span>
                      </div>
                    ) : studentBalance && studentBalance.credit > 0 ? (
                      <div className="flex justify-between py-1 text-green-700 border-t border-green-200 mt-1">
                        <span>Credit Available</span>
                        <span className="font-mono">GHS {studentBalance.credit.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 bg-emerald-50/70 px-4 py-3 text-sm dark:bg-blue-50">
                      {selectedStudentFeeDetails.discountAmount && selectedStudentFeeDetails.discountAmount > 0 ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-gray-600">Base Fee:</span>
                            <span className="font-medium line-through decoration-slate-400">GHS {selectedStudentFeeDetails.baseFee?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700 font-medium italic dark:text-indigo-600">Beneficiary Discount:</span>
                            <span className="font-semibold text-emerald-700 dark:text-indigo-600">− GHS {selectedStudentFeeDetails.discountAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-emerald-100 pt-1 dark:border-blue-100">
                            <span className="text-slate-600 font-semibold dark:text-gray-600">Net Total Term Bill:</span>
                            <span className="font-bold">GHS {selectedStudentFeeDetails.currentTermFee.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-gray-600">Total Term Bill:</span>
                          <span className="font-medium">GHS {selectedStudentFeeDetails.currentTermFee.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedStudentFeeDetails.arrears > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Arrears (prev term):</span>
                          <span className="font-semibold text-amber-700">+ GHS {selectedStudentFeeDetails.arrears.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-emerald-200 pt-1 col-span-2 dark:border-blue-200">
                        <span className="font-semibold text-emerald-950 dark:text-blue-900">Total Due:</span>
                        <span className="font-bold text-emerald-950 dark:text-blue-900">GHS {selectedStudentFeeDetails.totalAmountDue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-emerald-700 dark:text-green-700">Paid this term:</span>
                        <span className="font-medium text-emerald-700 dark:text-green-700">− GHS {selectedStudentFeeDetails.totalPaid.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className={`px-4 py-3 flex items-center justify-between ${outstandingBalance > 0 ? 'bg-red-50 border-t border-red-200' : 'bg-green-50 border-t border-green-200'}`}>
                      <span className={`font-bold text-base ${outstandingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        Outstanding Balance:
                      </span>
                      <span className={`font-bold text-xl ${outstandingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                        GHS {outstandingBalance.toFixed(2)}
                      </span>
                    </div>
                    {selectedStudentFeeDetails.creditBalance > 0 && (
                      <div className="px-4 py-2 bg-blue-50 border-t border-blue-200 flex justify-between text-sm">
                        <span className="text-blue-700">Credit Balance:</span>
                        <span className="font-semibold text-blue-700">GHS {selectedStudentFeeDetails.creditBalance.toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="font-semibold text-slate-800 dark:text-foreground">
                  Amount (GHS) *
                  {outstandingBalance > 0 && (
                    <button
                      type="button"
                      className="ml-2 text-xs text-emerald-700 underline dark:text-blue-600 disabled:opacity-50"
                      disabled={isSubmitting}
                      onClick={() => handleInputChange('amount', outstandingBalance.toFixed(2))}
                    >
                      Fill outstanding (GHS {outstandingBalance.toFixed(2)})
                    </button>
                  )}
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder={outstandingBalance > 0 ? `Outstanding: GHS ${outstandingBalance.toFixed(2)}` : '0.00'}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="font-semibold text-slate-800 dark:text-foreground">Payment Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <PaymentAccountSelect
              value={formData.paymentAccountId}
              onChange={(accountId, paymentMethod) =>
                setFormData((prev) => ({ ...prev, paymentAccountId: accountId, paymentMethod }))
              }
              disabled={isSubmitting}
              label="Payment Account"
            />

            <div className="space-y-2">
              <Label htmlFor="notes" className="font-semibold text-slate-800 dark:text-foreground">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about the payment..."
                rows={3}
                disabled={isSubmitting}
              />
            </div>

            <div className="flex justify-end border-t border-slate-100 pt-5 dark:border-border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex w-full md:w-auto">
                      <Button
                        type="submit"
                        variant="primaryAction"
                        className="w-full rounded-xl px-6 font-bold shadow-lg md:w-auto dark:rounded-md"
                        disabled={submitDisabled}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Recording payment…
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Record Payment
                          </>
                        )}
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {paymentOpsDisabled && paymentDisabledReason && (
                    <TooltipContent>{paymentDisabledReason}</TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </form>
        </CardContent>
      </Card>

      {receiptData && (
        <ReceiptPrinter
          receiptData={receiptData}
          show={showReceipt}
          onClose={() => setShowReceipt(false)}
          onPrint={() => {
            // Receipt is already available from server response
          }}
        />
      )}
    </>
  );
};

export default RecordPayment;
