
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CreditCard, Search, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'react-router-dom';
import React, { useState } from 'react';
import { calculateStudentFees } from '../../utils/feeCalculations';
import ReceiptPrinter from '../common/ReceiptPrinter';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { useActiveTerm } from '@/hooks/useSettings';
import { useBalances } from '@/hooks/useBalances';

const RecordPayment = () => {
  const { toast } = useToast();
  const { students } = useStudents();
  const { payments, createPayment } = usePayments();
  const { feeStructures } = useFeeStructures();
  const { data: activeTermData } = useActiveTerm();
  const hasActiveTerm = !!activeTermData;

  const currentTermId = activeTermData?.id;
  const currentTermName = activeTermData?.name || 'Term 1';
  const currentYear = activeTermData?.year || new Date().getFullYear().toString();

  const { arrearsMap, creditMap } = useBalances(currentTermId);

  const [formData, setFormData] = useState({
    studentId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'Cash',
    notes: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const { classes: classList } = useClasses();

  const normalizedStudents = (students || []).map((s: any) => {
    const id = String(s.id ?? s.student_id ?? '');
    const firstName = (s.first_name ?? s.firstName ?? '').toString();
    const lastName = (s.last_name ?? s.lastName ?? '').toString();
    const studentId = (s.admission_no ?? s.studentId ?? id).toString();
    let classAssigned = (s.class_assigned ?? s.classAssigned ?? '');
    if ((!classAssigned || classAssigned === '') && s.class_id) {
      const cls = (classList || []).find((c: any) => String(c.id) === String(s.class_id));
      if (cls) classAssigned = cls.level && cls.stream ? `${cls.level} ${cls.stream}` : (cls.level || cls.class_name || cls.className || cls.name || '');
    }

    return {
      ...s,
      id,
      firstName,
      lastName,
      studentId,
      classAssigned
    };
  });

  const filteredStudents = normalizedStudents.filter(student => {
    const q = (searchTerm || '').toLowerCase().trim();
    if (!q) return false;

    const tokens = q.split(/\s+/).filter(Boolean);
    const first = (student.firstName ?? '').toLowerCase();
    const last = (student.lastName ?? '').toLowerCase();
    const fullName = `${first} ${last}`.toLowerCase();
    const sid = student.studentId.toLowerCase();

    return tokens.every(t => (
      first.includes(t) ||
      last.includes(t) ||
      fullName.includes(t) ||
      sid.includes(t)
    ));
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const getStudentFeeDetails = (studentId: string) => {
    const student = normalizedStudents.find((s: any) => String(s.id) === String(studentId));
    if (!student) return null;

    return calculateStudentFees(
      studentId,
      activeTermData,
      student.classAssigned,
      feeStructures,
      payments,
      arrearsMap,
      creditMap
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.studentId || !formData.amount) {
      toast({
        title: "Validation Error",
        description: "Please select student and enter amount",
        variant: "destructive"
      });
      return;
    }

    const student = normalizedStudents.find((s: any) => String(s.id) === String(formData.studentId));
    if (!student) return;

    const paymentAmount = parseFloat(formData.amount);
    const feeDetails = getStudentFeeDetails(formData.studentId);
    if (!feeDetails) return;

    // Overpayment validation
    const remainingBalance = feeDetails.totalAmountDue - feeDetails.totalPaid;
    if (paymentAmount > remainingBalance) {
      toast({
        title: "Overpayment Error",
        description: `Payment amount (GHS ${paymentAmount.toFixed(2)}) exceeds the remaining balance (GHS ${remainingBalance.toFixed(2)}).`,
        variant: "destructive"
      });
      return;
    }

    const payload: any = {
      student_id: Number(formData.studentId),
      amount: paymentAmount,
      method: formData.paymentMethod,
      term_id: currentTermId,
      payment_date: formData.date,
      notes: formData.notes
    };

    createPayment.mutate(payload, {
      onSuccess: (res: any) => {
        const recordedPayment = res.data;
        const receiptNumber = recordedPayment?.receipt_number || 'RCP-' + Date.now().toString().slice(-6);

        const newPaidAmount = feeDetails.totalPaid + paymentAmount;
        const newBalance = Math.max(0, feeDetails.totalAmountDue - newPaidAmount);
        const newCreditBalance = Math.max(0, newPaidAmount - feeDetails.totalAmountDue);

        setReceiptData({
          studentName: `${student.firstName} ${student.lastName}`,
          studentId: student.studentId,
          className: student.classAssigned,
          amount: paymentAmount,
          date: recordedPayment?.payment_date || formData.date,
          paymentMethod: formData.paymentMethod,
          term: currentTermName,
          year: currentYear,
          receiptNumber: receiptNumber,
          notes: formData.notes,
          remainingBalance: newBalance,
          creditBalance: newCreditBalance,
          arrears: feeDetails.arrears,
          currentTermFee: feeDetails.currentTermFee,
          totalAmountDue: feeDetails.totalAmountDue
        } as any);

        setShowReceipt(true);

        toast({
          title: 'Payment Recorded',
          description: `Receipt #${receiptNumber} generated for ${student.firstName}`
        });

        setFormData({
          studentId: '',
          amount: '',
          date: new Date().toISOString().split('T')[0],
          paymentMethod: 'Cash',
          notes: ''
        });
        setSearchTerm('');
      }
    });
  };

  return (
    <>
      {!hasActiveTerm && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Academic Term</AlertTitle>
          <AlertDescription>
            You must have an active academic term before recording payments.
            Please go to <Link to="/dashboard/settings" className="font-bold underline">Settings</Link> to set an active term.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Record Payment</span>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {currentTermName}
              </Badge>
              <p className="text-sm text-gray-600">Academic Year: {currentYear}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentSearch">Search Student</Label>
              <div>
                <Select
                  value={formData.studentId}
                  disabled={!hasActiveTerm}
                  onValueChange={(val) => {
                    setFormData(prev => ({ ...prev, studentId: val }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Search by name or student ID..." />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2">
                      <div className="relative mb-2">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          id="studentSearch"
                          placeholder="Type name or ID to filter..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto">
                        {filteredStudents.length > 0 ? (
                          filteredStudents.map((student) => {
                            const feeDetails = getStudentFeeDetails(student.id);
                            const label = `${student.firstName || ''} ${student.lastName || ''}`.trim() || (student.meta?.name ?? student.name ?? '');
                            return (
                              <SelectItem key={student.id} value={student.id}>
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium">{label}</p>
                                    <p className="text-sm text-gray-500">ID: {student.studentId || student.id} | Class: {student.classAssigned}</p>
                                  </div>
                                  <div className="text-right">
                                    {feeDetails && (
                                      <div className="space-y-1">
                                        <p className="text-xs text-gray-500">Total Due: GHS {feeDetails.totalAmountDue.toFixed(2)}</p>
                                        <p className="text-sm font-bold text-blue-600">Money Left: GHS {feeDetails.remainingBalance.toFixed(2)}</p>
                                        {feeDetails.arrears > 0 && <p className="text-xs text-red-600">Incl. Arrears: GHS {feeDetails.arrears.toFixed(2)}</p>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })
                        ) : (
                          <div className="p-2 text-sm text-gray-500">No matching students</div>
                        )}
                      </div>
                    </div>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Fee Details Display */}
            {formData.studentId && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">Fee Details for {currentTermName}</h3>
                {(() => {
                  const feeDetails = getStudentFeeDetails(formData.studentId);
                  if (!feeDetails) return <p className="text-sm text-gray-600">No fee structure found</p>;

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Current Term Fee:</p>
                          <p className="font-medium">GHS {feeDetails.currentTermFee.toFixed(2)}</p>
                        </div>
                        {feeDetails.arrears > 0 && (
                          <div>
                            <p className="text-gray-600">Arrears:</p>
                            <p className="font-medium text-red-600">GHS {feeDetails.arrears.toFixed(2)}</p>
                          </div>
                        )}
                        {feeDetails.creditBalance > 0 && (
                          <div>
                            <p className="text-gray-600">Credit Balance:</p>
                            <p className="font-medium text-green-600">GHS {feeDetails.creditBalance.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-100 mt-4">
                        <span className="font-semibold text-blue-900">Money Left</span>
                        <Badge className="bg-blue-600 text-white text-lg px-4 py-1">
                          GHS {feeDetails.remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Badge>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (GHS) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Payment Method</Label>
              <Select value={formData.paymentMethod} onValueChange={(value) => handleInputChange('paymentMethod', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Additional notes about the payment..."
                rows={3}
              />
            </div>

            <div className="flex flex-col items-end space-y-2 pt-4 border-t">
              {!hasActiveTerm && <p className="text-sm text-red-500 font-medium pb-2">Please set an active academic term in settings to record payments.</p>}
              <Button
                type="submit"
                disabled={!hasActiveTerm || createPayment.isPending}
                size="lg"
                className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-700"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                {createPayment.isPending ? 'Processing...' : 'Record Payment'}
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
            toast({
              title: "Receipt Generated",
              description: "Payment receipt has been generated successfully",
            });
          }}
        />
      )}
    </>
  );
};

export default RecordPayment;
