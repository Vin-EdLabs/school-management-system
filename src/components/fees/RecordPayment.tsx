
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { CreditCard, Search, Loader2 } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { calculateStudentFeesSync, parseReceiptSnapshot, resolveReceiptDisplayAmounts } from '../../utils/feeCalculations';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { apiService } from '../../services/api';
import { useRecordPayment } from '../../hooks/useRecordPayment';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import { toast } from '@/hooks/use-toast';
import PaymentAccountSelect from '../common/PaymentAccountSelect';

const RecordPayment = () => {
  const { students, feeStructures, payments, arrearsBalances } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const recordPayment = useRecordPayment();

  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    paymentAccountId: '',
    notes: '',
    term: currentTerm || ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const [availableTerms, setAvailableTerms] = useState<any[]>([]);
  React.useEffect(() => {
    const fetchTerms = async () => {
      try {
        const terms = await apiService.get<any[]>('/finance/terms');
        setAvailableTerms(terms || []);
      } catch (err) {
        console.error('Failed to fetch terms:', err);
      }
    };
    fetchTerms();
  }, []);

  React.useEffect(() => {
    if (currentTerm && !formData.term) {
      setFormData(prev => ({ ...prev, term: currentTerm }));
    }
  }, [currentTerm]);

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
    const student = students.find(s => s.id === formData.studentId);
    if (!student) return null;
    return calculateStudentFeesSync(
      formData.studentId,
      currentTerm,
      student.classAssigned,
      feeStructures || [],
      payments || [],
      student.classAssignedId,
      arrearsBalances,
      {
        isBeneficiary: !!student.isBeneficiary,
        discountType: student.discountType,
        discountValue: student.discountValue
      }
    );
  }, [formData.studentId, currentTerm, students, feeStructures, payments, arrearsBalances]);

  const outstandingBalance = selectedStudentFeeDetails
    ? Math.max(0, selectedStudentFeeDetails.totalAmountDue - selectedStudentFeeDetails.totalPaid)
    : 0;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isSubmitting = recordPayment.isPending;

  const resetForm = () => {
    setFormData({
      studentId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      paymentAccountId: '',
      notes: '',
      term: currentTerm || '',
    });
    setSearchTerm('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    const paymentTerm = formData.term || currentTerm;
    const paymentNotes = formData.notes;

    const feeDetails = calculateStudentFeesSync(
      formData.studentId,
      paymentTerm,
      student.classAssigned,
      feeStructures || [],
      payments || [],
      student.classAssignedId,
      arrearsBalances,
      {
        isBeneficiary: !!student.isBeneficiary,
        discountType: student.discountType,
        discountValue: student.discountValue,
      }
    );

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
        remainingBalance: amounts.remainingBalance,
        creditBalance: amounts.creditBalance,
        arrears: amounts.arrears,
        currentTermFee: amounts.currentTermFee,
        totalAmountDue: amounts.totalAmountDue,
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
            <div className="space-y-2">
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
                    Fee Breakdown — {currentTerm.replace(new RegExp(`\\s+${currentYear}$`), '')} {currentYear}
                  </h3>
                </div>
                {!selectedStudentFeeDetails ? (
                  <div className="p-4 bg-emerald-50/60 text-sm text-slate-500 dark:bg-blue-50 dark:text-gray-500">No fee structure set for this student's class and term.</div>
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
                            <span className="text-slate-600 font-semibold dark:text-gray-600">Net Term Fee:</span>
                            <span className="font-bold">GHS {selectedStudentFeeDetails.currentTermFee.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-slate-600 dark:text-gray-600">Term Fee:</span>
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

            <div className="space-y-2">
                <Label htmlFor="term" className="font-semibold text-slate-800 dark:text-foreground">Academic Term</Label>
              <Select
                value={formData.term}
                onValueChange={(value) => handleInputChange('term', value)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="term" disabled={isSubmitting}>
                  <SelectValue placeholder="Select Term" />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.length > 0 ? (
                    availableTerms.map((t) => (
                      <SelectItem key={t.id} value={`${t.name} ${t.academic_year_name}`}>
                        {t.name} {t.academic_year_name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={currentTerm}>{currentTerm}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

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
              <Button
                type="submit"
                variant="primaryAction"
                className="w-full rounded-xl px-6 font-bold shadow-lg md:w-auto dark:rounded-md"
                disabled={!formData.studentId || !formData.amount || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Recording payment…
                  </>
                ) : (
                  'Record Payment'
                )}
              </Button>
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
