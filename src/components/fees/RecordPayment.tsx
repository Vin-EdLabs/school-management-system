
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
import { parseReceiptSnapshot, resolveReceiptDisplayAmounts, applyBeneficiaryToBaseFee } from '../../utils/feeCalculations';
import { useTermReadOnly } from '../../contexts/TermStatusContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { useRecordPayment } from '../../hooks/useRecordPayment';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import BoardingFeeBreakdownDisplay from './BoardingFeeBreakdownDisplay';
import PaymentAccountSelect from '../common/PaymentAccountSelect';
import {
  fetchStudentBalance,
  type StudentBalance,
} from '../../services/studentBalance';
import { resolveStudentDisplayBalance } from '../../utils/resolveStudentDisplayBalance';
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
  const { students, payments, feeStructures, ledgerBalances, loadDomains } = useData();
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
    void loadDomains(['students', 'fees'], { silent: true });
    const cached = ledgerBalances[formData.studentId];
    if (cached) {
      setStudentBalance(cached);
    } else {
      void loadDomains(['fees'], { silent: true });
    }
    let cancelled = false;
    setBalanceLoading(!cached);
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
  }, [formData.studentId, payments, ledgerBalances, loadDomains]);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === formData.studentId),
    [students, formData.studentId]
  );

  const paymentTerm =
    currentTerm && currentTerm !== 'Not Set' ? currentTerm : null;

  const enrichedStudentBalance = useMemo(() => {
    if (!selectedStudent) return studentBalance;
    const cached = ledgerBalances[formData.studentId];
    const source = studentBalance ?? cached ?? null;
    const display = resolveStudentDisplayBalance(
      selectedStudent,
      source,
      feeStructures || [],
      paymentTerm
    );
    const individualCharges = source?.individualCharges ?? 0;
    const boardingFees = source?.boardingFees ?? 0;
    const grossForDiscount =
      (termBillSummary?.total ?? 0) > 0
        ? termBillSummary!.total
        : display.currentTermFee;
    const { currentTermFee: netTermFee } = applyBeneficiaryToBaseFee(
      grossForDiscount,
      selectedStudent
    );
    const termFee = selectedStudent?.isBeneficiary
      ? netTermFee
      : display.currentTermFee > 0
        ? display.currentTermFee
        : grossForDiscount;
    const totalDue = selectedStudent?.isBeneficiary
      ? Math.round((termFee + display.arrears + individualCharges + boardingFees) * 100) / 100
      : display.totalDue > 0
        ? display.totalDue
        : Math.round((termFee + display.arrears + individualCharges + boardingFees) * 100) / 100;
    const outstanding = display.outstanding;
    const termBillTotal = termBillSummary?.total ?? 0;
    if (!source && termBillTotal <= 0 && !selectedStudent?.isBeneficiary) return null;
    if (!source && termBillTotal <= 0 && selectedStudent?.isBeneficiary && grossForDiscount <= 0) return null;
    return {
      ...(source ?? {
        currentTermName: paymentTerm,
        activeTermId: null,
        arrearLines: [],
        paidLines: [],
        status: outstanding > 0 ? ('Owing' as const) : ('Cleared' as const),
        credit: 0,
        creditBroughtForward: 0,
        individualCharges: 0,
        boardingFees: 0,
        individualChargeLines: [],
      }),
      currentTermFee: termFee,
      totalArrears: display.arrears,
      totalDue,
      totalPaid: display.totalPaid,
      outstanding,
      credit: display.credit,
      status: display.status,
    } as StudentBalance;
  }, [
    studentBalance,
    selectedStudent,
    feeStructures,
    paymentTerm,
    termBillSummary,
    ledgerBalances,
    formData.studentId,
    selectedStudent?.isBeneficiary,
    selectedStudent?.discountType,
    selectedStudent?.discountValue,
  ]);

  useEffect(() => {
    if (!formData.studentId || !selectedStudent) {
      setTermBillSummary(null);
      return;
    }
    const feeStructureId = resolveFeeStructureId(
      feeStructures,
      selectedStudent.classAssigned,
      selectedStudent.classAssignedId,
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
    if (!enrichedStudentBalance) return null;

    const grossFee = termBillSummary?.total ?? enrichedStudentBalance.currentTermFee;
    const { currentTermFee: netTermFee, discountAmount } = applyBeneficiaryToBaseFee(
      grossFee,
      selectedStudent
    );
    const currentTermFee = selectedStudent?.isBeneficiary
      ? netTermFee
      : enrichedStudentBalance.currentTermFee;
    const individualCharges = enrichedStudentBalance.individualCharges ?? 0;
    const boardingFees = enrichedStudentBalance.boardingFees ?? 0;
    const creditBroughtForward = enrichedStudentBalance.creditBroughtForward ?? 0;
    const grossDue = Math.round(
      (currentTermFee + enrichedStudentBalance.totalArrears + individualCharges + boardingFees) * 100
    ) / 100;
    const netAmountDue = Math.round((grossDue - creditBroughtForward) * 100) / 100;
    const arrearsBreakdown = studentBalance?.arrearsBreakdown ?? [];

    return {
      currentTermFee,
      arrears: enrichedStudentBalance.totalArrears,
      creditBroughtForward,
      grossDue,
      netAmountDue,
      totalAmountDue: selectedStudent?.isBeneficiary
        ? grossDue
        : enrichedStudentBalance.totalDue > 0
          ? enrichedStudentBalance.totalDue
          : grossDue,
      totalPaid: enrichedStudentBalance.totalPaid,
      outstanding: enrichedStudentBalance.outstanding,
      creditBalance: enrichedStudentBalance.credit,
      individualCharges,
      boardingFees,
      boardingFeeBreakdown: enrichedStudentBalance.boardingFeeBreakdown,
      individualChargeLines: enrichedStudentBalance.individualChargeLines ?? [],
      baseFee: grossFee,
      discountAmount,
      arrearLines: enrichedStudentBalance.arrearLines,
      arrearsBreakdown,
      paidLines: enrichedStudentBalance.paidLines,
    };
  }, [
    formData.studentId,
    currentTerm,
    enrichedStudentBalance,
    termBillSummary,
    selectedStudent?.isBeneficiary,
    selectedStudent?.discountType,
    studentBalance?.arrearsBreakdown,
    selectedStudent?.discountValue,
  ]);

  const outstandingBalance = Math.max(
    0,
    selectedStudentFeeDetails?.outstanding ??
      enrichedStudentBalance?.outstanding ??
      Math.round(
        ((selectedStudentFeeDetails?.netAmountDue ?? selectedStudentFeeDetails?.totalAmountDue ?? 0) -
          (enrichedStudentBalance?.totalPaid ?? 0)) *
          100
      ) / 100
  );

  const arrearsDisplayLines = useMemo(() => {
    if (!selectedStudentFeeDetails) return [];
    const breakdown = selectedStudentFeeDetails.arrearsBreakdown ?? [];
    if (breakdown.length > 0) {
      return breakdown.map((line, i) => ({
        key: `arrear-bd-${i}-${line.description}`,
        label: line.description,
        amount: line.amount,
        date: line.date,
      }));
    }
    const lines = selectedStudentFeeDetails.arrearLines ?? [];
    if (lines.length > 0) {
      return lines.map((line, i) => ({
        key: `arrear-line-${i}`,
        label: line.termName,
        amount: line.amount,
        date: null as string | null,
      }));
    }
    if (selectedStudentFeeDetails.arrears > 0) {
      return [
        {
          key: 'arrear-total',
          label: 'Arrears (previous terms)',
          amount: selectedStudentFeeDetails.arrears,
          date: null,
        },
      ];
    }
    return [];
  }, [selectedStudentFeeDetails]);

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
      const createdPayment = (res.payment ?? res) as {
        receipt_number?: string;
        receipt_snapshot?: Parameters<typeof parseReceiptSnapshot>[0];
      };
      const serverBalance = res.balance;
      const snap = parseReceiptSnapshot(createdPayment.receipt_snapshot);
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
        receiptNumber: createdPayment.receipt_number || `R${Date.now().toString().slice(-8)}`,
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
        paidCharges: snap?.paidCharges,
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

                {balanceLoading || termBillLoading ? (
                  <div className="p-4 bg-emerald-50/60 text-sm text-slate-500 dark:bg-blue-50 dark:text-gray-500 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading fee breakdown…
                  </div>
                ) : !selectedStudentFeeDetails ? (
                  <div className="p-4 bg-emerald-50/60 text-sm text-slate-500 dark:bg-blue-50 dark:text-gray-500">
                    No fee structure set for this student&apos;s class and term.
                  </div>
                ) : (
                  <div className="border-b border-emerald-200/80 bg-white/60 px-4 py-3 dark:bg-blue-50/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-900/70 mb-2">
                      Term Bill Breakdown
                    </p>
                    <div className="space-y-1 text-sm">
                      {termBillSummary ? (
                        termBillSummary.items.map((item) => (
                          <div key={item.item_name} className="flex justify-between py-0.5">
                            <span className="text-slate-600 dark:text-gray-600">
                              {formatFeeItemLabel(item.item_name)}
                            </span>
                            <span className="font-mono tabular-nums">
                              GHS {Number(item.amount).toFixed(2)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between py-0.5">
                          <span className="text-slate-600 dark:text-gray-600">Term Fee</span>
                          <span className="font-mono tabular-nums">
                            GHS {(selectedStudentFeeDetails.baseFee || selectedStudentFeeDetails.currentTermFee).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {(selectedStudentFeeDetails.discountAmount ?? 0) > 0 && (
                        <div className="flex justify-between py-0.5">
                          <span className="text-orange-600 font-medium">
                            Beneficiary Discount (
                            {selectedStudent?.discountType === 'percentage'
                              ? `${Number(selectedStudent?.discountValue).toFixed(0)}%`
                              : 'Fixed'}
                            )
                          </span>
                          <span className="font-mono tabular-nums text-orange-600">
                            −GHS {(selectedStudentFeeDetails.discountAmount ?? 0).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {(selectedStudentFeeDetails.boardingFees ?? 0) > 0 && (
                        <div className="py-0.5 border-t border-dashed border-emerald-100">
                          <BoardingFeeBreakdownDisplay
                            breakdown={
                              selectedStudentFeeDetails.boardingFeeBreakdown ?? {
                                lodging: selectedStudentFeeDetails.boardingFees ?? 0,
                                feeding: 0,
                              }
                            }
                            total={selectedStudentFeeDetails.boardingFees ?? 0}
                            compact
                          />
                        </div>
                      )}

                      {selectedStudentFeeDetails.individualChargeLines.map((charge) => (
                        <div key={charge.id} className="flex justify-between py-0.5 border-t border-dashed border-emerald-100">
                          <span className="text-slate-600 text-xs sm:text-sm">
                            {charge.description}
                            <span className="block text-[10px] text-amber-700">Individual Charge</span>
                          </span>
                          <span className="font-mono tabular-nums text-amber-800">
                            GHS {Number(charge.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}

                      {arrearsDisplayLines.map((line) => (
                        <div key={line.key} className="flex justify-between py-0.5 border-t border-dashed border-amber-100">
                          <span className="text-amber-800 text-xs sm:text-sm">
                            {line.label}
                            <span className="block text-[10px] text-amber-600">Arrears</span>
                          </span>
                          <span className="font-mono tabular-nums text-amber-800">
                            GHS {Number(line.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}

                      {(selectedStudentFeeDetails.creditBroughtForward ?? 0) > 0 && (
                        <div className="flex justify-between py-0.5 border-t border-dashed border-blue-100">
                          <span className="text-blue-700 text-xs sm:text-sm">
                            Credit Brought Forward
                          </span>
                          <span className="font-mono tabular-nums text-blue-700">
                            −GHS {(selectedStudentFeeDetails.creditBroughtForward ?? 0).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="border-t border-emerald-200 pt-2 mt-2 space-y-1">
                        <div className="flex justify-between font-semibold">
                          <span>Total Amount Due</span>
                          <span className="font-mono tabular-nums">
                            GHS {(selectedStudentFeeDetails.netAmountDue ?? selectedStudentFeeDetails.totalAmountDue).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-emerald-700">
                          <span>Amount Paid So Far</span>
                          <span className="font-mono tabular-nums">
                            GHS {(selectedStudentFeeDetails.totalPaid ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <div className={`flex justify-between font-semibold ${outstandingBalance > 0 ? 'text-red-700' : 'text-green-700'}`}>
                          <span>Outstanding Balance</span>
                          <span className="font-mono tabular-nums">GHS {outstandingBalance.toFixed(2)}</span>
                        </div>
                        {(selectedStudentFeeDetails.creditBalance ?? 0) > 0 && (
                          <div className="flex justify-between text-blue-700">
                            <span>Credit Balance</span>
                            <span className="font-mono tabular-nums">
                              GHS {(selectedStudentFeeDetails.creditBalance ?? 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
