
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { Search, Receipt, Eye, Pencil, Lock } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import ReceiptCorrectionModal from './ReceiptCorrectionModal';
import { receiptAmountsForPayment } from '../../utils/feeCalculations';
import { formatDisplayDate } from '../../utils/dateFormat';
import { invalidateFinanceQueries } from '../../hooks/useFinanceRealtime';
import { useSchool } from '../../contexts/SchoolContext';
import { apiService } from '../../services/api';
import type { Payment } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

const CORRECTION_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const LOCK_TOOLTIP = 'This receipt is locked and cannot be corrected after 7 days';

type CorrectionUiState = 'voided' | 'corrected' | 'correctable' | 'locked';

function getRootPayment(payment: Payment, paymentById: Map<string, Payment>): Payment {
  let current: Payment = payment;
  const seen = new Set<string>();
  while (current.correctsPaymentId && !seen.has(current.correctsPaymentId)) {
    seen.add(current.id);
    const parent = paymentById.get(current.correctsPaymentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

function getCorrectionUiState(payment: Payment, paymentById: Map<string, Payment>): CorrectionUiState {
  if (payment.isVoided) return 'voided';
  if (payment.correctedByPaymentId) return 'voided';
  const root = getRootPayment(payment, paymentById);
  const created = new Date(root.recordedAt || '');
  if (Number.isNaN(created.getTime())) return 'locked';
  if (Date.now() - created.getTime() > CORRECTION_WINDOW_MS) return 'locked';
  return 'correctable';
}

function canCorrectReceipt(payment: Payment, paymentById: Map<string, Payment>) {
  return getCorrectionUiState(payment, paymentById) === 'correctable';
}

const ReceiptHistory = () => {
  const { payments, students, feeStructures, refresh, ledgerBalances } = useData();
  const { hasAccess } = useAuth();
  const { currentTerm } = useActiveTerm();
  const queryClient = useQueryClient();
  const { schoolId } = useSchool();
  const canCorrect = hasAccess('fees');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'current' | 'archived'>('current');
  const [archivedPayments, setArchivedPayments] = useState<Payment[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [correctionPayment, setCorrectionPayment] = useState<Payment | null>(null);

  const activeTermId = useMemo(() => {
    const first = Object.values(ledgerBalances || {})[0];
    return first?.activeTermId ?? null;
  }, [ledgerBalances]);

  const mapPaymentRow = useCallback((p: any): Payment => ({
    id: (p.id ?? p.payment_id)?.toString() ?? '',
    studentId: (p.student_id ?? p.studentId)?.toString() || '',
    studentIdNum: p.student_id ?? p.studentId,
    amount: parseFloat(p.amount ?? p.amount_paid ?? 0),
    date: p.payment_date?.split?.('T')?.[0] ?? p.date ?? '',
    recordedAt: p.created_at ?? p.recorded_at ?? p.payment_date ?? p.date,
    paymentMethod: p.payment_method ?? p.paymentMethod ?? '',
    paymentAccountId: p.payment_account_id != null ? String(p.payment_account_id) : undefined,
    term: p.term ?? '',
    termId: p.term_id != null ? Number(p.term_id) : null,
    notes: p.notes ?? '',
    receiptNumber: p.receipt_number ?? p.receiptNumber,
    isVoided: !!p.is_voided,
    isLocked: !!p.is_locked,
    correctedByPaymentId: p.corrected_by_payment_id != null ? String(p.corrected_by_payment_id) : undefined,
    correctsPaymentId: p.corrects_payment_id != null ? String(p.corrects_payment_id) : undefined,
    correctedAt: p.corrected_at ?? undefined,
    correctionReason: p.correction_reason ?? undefined,
    receiptVersion: p.receipt_version != null ? Number(p.receipt_version) : undefined,
    receiptSnapshot: p.receipt_snapshot ?? p.receiptSnapshot ?? undefined,
  }), []);

  useEffect(() => {
    if (viewMode !== 'archived') return;
    let cancelled = false;
    setArchivedLoading(true);
    void apiService
      .get<any[]>('/payments?archived=true')
      .then((rows) => {
        if (!cancelled) {
          setArchivedPayments((Array.isArray(rows) ? rows : []).map(mapPaymentRow));
        }
      })
      .catch(() => {
        if (!cancelled) setArchivedPayments([]);
      })
      .finally(() => {
        if (!cancelled) setArchivedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [viewMode, mapPaymentRow, payments.length]);

  const sourcePayments = viewMode === 'archived' ? archivedPayments : payments;

  const paymentById = useMemo(() => {
    const map = new Map<string, Payment>();
    [...payments, ...archivedPayments].forEach((p) => map.set(p.id, p));
    return map;
  }, [payments, archivedPayments]);

  const isReceiptSearch = /^r\d/i.test(searchTerm.trim());

  const filteredPayments = useMemo(() => {
    const base = isReceiptSearch
      ? [...payments, ...archivedPayments]
      : sourcePayments;

    const termFiltered = isReceiptSearch
      ? base
      : viewMode === 'current'
        ? base.filter((p) => {
            if (p.isVoided) return false;
            if (activeTermId != null && p.termId != null) return p.termId === activeTermId;
            return !currentTerm || p.term === currentTerm || p.term?.startsWith(currentTerm);
          })
        : base;

    return termFiltered
      .filter((payment) => {
        const student = students.find((s) => s.id === payment.studentId);
        const receiptNumber = payment.receiptNumber || '';
        return (
          searchTerm === '' ||
          receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (student &&
            (student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
              student.studentId.includes(searchTerm)))
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [
    sourcePayments,
    payments,
    archivedPayments,
    students,
    searchTerm,
    viewMode,
    activeTermId,
    currentTerm,
    isReceiptSearch,
  ]);

  const handleViewReceipt = async (payment: Payment) => {
    const student = students.find(s => s.id === payment.studentId);
    if (!student) return;

    const activePayments = payments.filter((p) => !p.isVoided);
    const amounts = receiptAmountsForPayment(payment, activePayments, student, feeStructures);

    let correctionHistory: {
      correctionCount: number;
      chain: Array<{ receiptNumber: string; amount: number; isVoided: boolean }>;
      rootReceiptNumber?: string;
    } | undefined;

    try {
      const history = await apiService.get<{
        correctionCount: number;
        rootReceiptNumber: string;
        chain: Array<{ receiptNumber: string; amount: number; isVoided: boolean }>;
      }>(`/payments/${payment.id}/correction-history`);
      if (history.correctionCount > 0) {
        correctionHistory = {
          correctionCount: history.correctionCount,
          chain: history.chain,
          rootReceiptNumber: history.rootReceiptNumber,
        };
      }
    } catch {
      correctionHistory = undefined;
    }

    const receiptData = {
      studentName: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: payment.amount,
      date: payment.date,
      paymentMethod: payment.paymentMethod,
      term: payment.term,
      receiptNumber: payment.receiptNumber || `R${payment.id.toString().padStart(8, '0')}`,
      notes: payment.notes,
      remainingBalance: amounts.remainingBalance,
      creditBalance: amounts.creditBalance,
      arrears: amounts.arrears,
      currentTermFee: amounts.currentTermFee,
      totalAmountDue: amounts.totalAmountDue,
      correctionHistory,
    };

    setSelectedReceipt(receiptData);
    setShowReceipt(true);
  };

  const renderStatusBadges = (payment: Payment) => {
    if (payment.isVoided) {
      const replacement = payment.correctedByPaymentId
        ? paymentById.get(payment.correctedByPaymentId)
        : null;
      return (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="destructive">VOIDED</Badge>
          {replacement && (
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-emerald-600"
              data-readonly-allow="view"
              onClick={() => handleViewReceipt(replacement)}
            >
              View {replacement.receiptNumber}
            </Button>
          )}
        </div>
      );
    }
    if (payment.correctsPaymentId && !payment.isVoided) {
      const predecessor = paymentById.get(payment.correctsPaymentId);
      return (
        <div className="flex flex-wrap items-center gap-1">
          <Badge className="bg-emerald-600 hover:bg-emerald-600">CORRECTED</Badge>
          {predecessor && (
            <Button
              variant="link"
              className="h-auto p-0 text-xs text-muted-foreground"
              data-readonly-allow="view"
              onClick={() => handleViewReceipt(predecessor)}
            >
              Previous {predecessor.receiptNumber}
            </Button>
          )}
        </div>
      );
    }
    if (getCorrectionUiState(payment, paymentById) === 'locked') {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span className="text-xs">Locked</span>
            </span>
          </TooltipTrigger>
          <TooltipContent>{LOCK_TOOLTIP}</TooltipContent>
        </Tooltip>
      );
    }
    return null;
  };

  const handleCorrected = () => {
    refresh(['payments', 'fees']);
    invalidateFinanceQueries(queryClient, schoolId);
  };

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5" />
              <span>Receipt History</span>
            </div>
            <div className="readonly-view-allow flex rounded-lg border border-border overflow-hidden text-sm">
              <button
                type="button"
                className={`px-3 py-1.5 ${viewMode === 'current' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}
                onClick={() => setViewMode('current')}
              >
                Current Term
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 ${viewMode === 'archived' ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'}`}
                onClick={() => setViewMode('archived')}
              >
                Archived
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="readonly-view-allow relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by receipt number, student name, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-background border-border"
              />
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Receipt #</TableHead>
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Student</TableHead>
                    <TableHead className="font-semibold text-foreground">Amount</TableHead>
                    <TableHead className="font-semibold text-foreground">Date</TableHead>
                    <TableHead className="font-semibold text-foreground">Method</TableHead>
                    <TableHead className="font-semibold text-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedLoading && viewMode === 'archived' ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">
                        Loading archived receipts…
                      </TableCell>
                    </TableRow>
                  ) : filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground italic">
                        No receipts found matching your search
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const student = students.find(s => s.id === payment.studentId);
                      const receiptNumber = payment.receiptNumber || '-';
                      const uiState = getCorrectionUiState(payment, paymentById);
                      const showCorrect = canCorrect && canCorrectReceipt(payment, paymentById);
                      const showLock = canCorrect && uiState === 'locked';
                      return (
                        <TableRow key={payment.id} className={payment.isVoided ? 'opacity-70' : undefined}>
                          <TableCell>
                            <span className="font-mono text-xs bg-muted text-foreground px-2 py-1 rounded-md border border-border/50">
                              {receiptNumber}
                            </span>
                          </TableCell>
                          <TableCell>{renderStatusBadges(payment)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium text-foreground">
                                {student?.firstName} {student?.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {student?.studentId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className={`font-bold ${payment.isVoided ? 'line-through text-muted-foreground' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              GHS {payment.amount.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-foreground">{formatDisplayDate(payment.date)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                data-readonly-allow="view"
                                onClick={() => handleViewReceipt(payment)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/10"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {showCorrect && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCorrectionPayment(payment)}
                                  className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                  title="Correct receipt"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {showLock && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">
                                      <Lock className="h-4 w-4" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>{LOCK_TOOLTIP}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredPayments.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {filteredPayments.length} of {payments.length} receipts
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedReceipt && (
        <ReceiptPrinter
          receiptData={selectedReceipt}
          show={showReceipt}
          onClose={() => setShowReceipt(false)}
          onPrint={() => {
            console.log('Receipt reprinted:', selectedReceipt.receiptNumber);
          }}
        />
      )}

      <ReceiptCorrectionModal
        open={!!correctionPayment}
        onClose={() => setCorrectionPayment(null)}
        payment={correctionPayment}
        onCorrected={handleCorrected}
      />
    </TooltipProvider>
  );
};

export default ReceiptHistory;
