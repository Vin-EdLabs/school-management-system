
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { CreditCard, Search } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { calculateStudentFeesSync } from '../../utils/feeCalculations';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

const RecordPayment = () => {
  const { students, addPayment, feeStructures, payments, arrearsBalances, refresh } = useData();
  const { currentTerm, currentYear } = useActiveTerm();

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

  const filteredStudents = students.filter(student =>
    student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId.includes(searchTerm)
  );

  // Derive fee details synchronously from DataContext data — includes term_arrears via arrearsBalances
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

  // Outstanding balance = totalAmountDue - totalPaid
  const outstandingBalance = selectedStudentFeeDetails
    ? Math.max(0, selectedStudentFeeDetails.totalAmountDue - selectedStudentFeeDetails.totalPaid)
    : 0;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    const feeDetails = selectedStudentFeeDetails;

    const createdPayment = await addPayment({
      ...formData,
      amount: paymentAmount,
      term: currentTerm,
      academicYear: currentYear
    });
    await refresh();

    const newPaidAmount = feeDetails.totalPaid + paymentAmount;
    const newBalance = Math.max(0, feeDetails.totalAmountDue - newPaidAmount);
    const newCreditBalance = Math.max(0, newPaidAmount - feeDetails.totalAmountDue);

    setReceiptData({
      studentName: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: paymentAmount,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      term: currentTerm,
      year: currentYear,
      receiptNumber: createdPayment.receiptNumber || `R${Date.now().toString().slice(-8)}`,
      notes: formData.notes,
      remainingBalance: newBalance,
      creditBalance: newCreditBalance,
      arrears: feeDetails.arrears,
      currentTermFee: feeDetails.currentTermFee,
      totalAmountDue: feeDetails.totalAmountDue
    } as any);
    setShowReceipt(true);

    toast({ title: 'Payment Recorded', description: `GHS ${paymentAmount.toFixed(2)} recorded for ${student.firstName} ${student.lastName}` });

    setFormData({ studentId: '', amount: '', date: new Date().toISOString().split('T')[0], paymentMethod: 'Cash', notes: '' });
    setSearchTerm('');
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Record Payment</span>
            </div>
            <div className="text-right">
              <Badge variant="outline" className="mb-1">
                {currentTerm}
              </Badge>
              <p className="text-sm text-gray-600">Academic Year: {currentYear}</p>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="studentSearch">Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="studentSearch"
                  placeholder="Search by name or student ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchTerm && (
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {filteredStudents.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0"
                      onClick={() => {
                        setFormData(prev => ({...prev, studentId: student.id}));
                        setSearchTerm(`${student.firstName} ${student.lastName} - ${student.studentId}`);
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{student.firstName} {student.lastName}</p>
                          <p className="text-sm text-gray-500">
                            ID: {student.studentId} | Class: {student.classAssigned}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fee Details Display */}
            {formData.studentId && (
              <div className="rounded-lg border border-blue-200 overflow-hidden">
                <div className="bg-blue-600 px-4 py-2">
                  <h3 className="font-semibold text-white text-sm">
                    Fee Breakdown — {currentTerm.replace(new RegExp(`\\s+${currentYear}$`), '')} {currentYear}
                  </h3>
                </div>
                {!selectedStudentFeeDetails ? (
                  <div className="p-4 bg-blue-50 text-sm text-gray-500">No fee structure set for this student's class and term.</div>
                ) : (
                  <>
                    <div className="bg-blue-50 px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                      {selectedStudentFeeDetails.discountAmount && selectedStudentFeeDetails.discountAmount > 0 ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Base Fee:</span>
                            <span className="font-medium line-through decoration-slate-400">GHS {selectedStudentFeeDetails.baseFee?.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-indigo-600 font-medium italic">Beneficiary Discount:</span>
                            <span className="font-semibold text-indigo-600">− GHS {selectedStudentFeeDetails.discountAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between border-t border-blue-100 pt-1">
                            <span className="text-gray-600 font-semibold">Net Term Fee:</span>
                            <span className="font-bold">GHS {selectedStudentFeeDetails.currentTermFee.toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Term Fee:</span>
                          <span className="font-medium">GHS {selectedStudentFeeDetails.currentTermFee.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedStudentFeeDetails.arrears > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Arrears (prev term):</span>
                          <span className="font-semibold text-amber-700">+ GHS {selectedStudentFeeDetails.arrears.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-blue-200 pt-1 col-span-2">
                        <span className="font-semibold text-blue-900">Total Due:</span>
                        <span className="font-bold text-blue-900">GHS {selectedStudentFeeDetails.totalAmountDue.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Paid this term:</span>
                        <span className="font-medium text-green-700">− GHS {selectedStudentFeeDetails.totalPaid.toFixed(2)}</span>
                      </div>
                    </div>
                    {/* Outstanding balance — the main figure */}
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
                <Label htmlFor="amount">
                  Amount (GHS) *
                  {outstandingBalance > 0 && (
                    <button
                      type="button"
                      className="ml-2 text-xs text-blue-600 underline"
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

            <Button type="submit" className="w-full md:w-auto" disabled={!formData.studentId}>
              Record Payment & Generate Receipt
            </Button>
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
