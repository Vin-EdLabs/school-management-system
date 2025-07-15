
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { toast } from '@/hooks/use-toast';
import { CreditCard, Search, AlertCircle } from 'lucide-react';
import ReceiptPrinter from '../common/ReceiptPrinter';
import { calculateStudentFees, getActiveAcademicTerm, getActiveAcademicYear } from '../../utils/feeCalculations';

const RecordPayment = () => {
  const { students, addPayment, feeStructures, payments } = useData();
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

  const currentTerm = getActiveAcademicTerm();
  const currentYear = getActiveAcademicYear();

  const filteredStudents = students.filter(student =>
    student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentId.includes(searchTerm)
  );

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RG${timestamp}${random}`;
  };

  const getStudentFeeDetails = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return null;

    return calculateStudentFees(
      studentId,
      currentTerm,
      student.classAssigned,
      feeStructures,
      payments
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

    const student = students.find(s => s.id === formData.studentId);
    if (!student) {
      toast({
        title: "Error",
        description: "Student not found",
        variant: "destructive"
      });
      return;
    }

    const receiptNumber = generateReceiptNumber();
    const paymentAmount = parseFloat(formData.amount);
    
    // Get fee details before payment
    const feeDetails = getStudentFeeDetails(formData.studentId);
    if (!feeDetails) {
      toast({
        title: "Error",
        description: "Could not calculate fee details",
        variant: "destructive"
      });
      return;
    }

    // Add payment record
    addPayment({
      ...formData,
      amount: paymentAmount,
      term: currentTerm
    });

    // Calculate new balances after payment
    const newPaidAmount = feeDetails.totalPaid + paymentAmount;
    const newBalance = Math.max(0, feeDetails.totalAmountDue - newPaidAmount);
    const newCreditBalance = Math.max(0, newPaidAmount - feeDetails.totalAmountDue);

    // Update credit balance if overpayment
    if (newCreditBalance > 0) {
      localStorage.setItem(`credit-${formData.studentId}`, newCreditBalance.toString());
    }

    // Prepare receipt data
    const newReceiptData = {
      studentName: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: paymentAmount,
      date: formData.date,
      paymentMethod: formData.paymentMethod,
      term: currentTerm,
      year: currentYear,
      receiptNumber: receiptNumber,
      notes: formData.notes,
      remainingBalance: newBalance,
      creditBalance: newCreditBalance,
      arrears: feeDetails.arrears,
      currentTermFee: feeDetails.currentTermFee,
      totalAmountDue: feeDetails.totalAmountDue
    };

    setReceiptData(newReceiptData);
    setShowReceipt(true);

    toast({
      title: "Payment Recorded",
      description: `GHS ${formData.amount} payment recorded for ${student.firstName} ${student.lastName}`,
    });

    // Reset form
    setFormData({
      studentId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'Cash',
      notes: ''
    });
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
                  {filteredStudents.map((student) => {
                    const feeDetails = getStudentFeeDetails(student.id);
                    return (
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
                          <div className="text-right">
                            {feeDetails && (
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-orange-600">
                                  Due: GHS {feeDetails.totalAmountDue.toFixed(2)}
                                </p>
                                {feeDetails.arrears > 0 && (
                                  <p className="text-xs text-red-600">
                                    Arrears: GHS {feeDetails.arrears.toFixed(2)}
                                  </p>
                                )}
                                {feeDetails.creditBalance > 0 && (
                                  <p className="text-xs text-green-600">
                                    Credit: GHS {feeDetails.creditBalance.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fee Details Display */}
            {formData.studentId && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-800 mb-2">Fee Details for {currentTerm}</h3>
                {(() => {
                  const feeDetails = getStudentFeeDetails(formData.studentId);
                  if (!feeDetails) return <p className="text-sm text-gray-600">No fee structure found</p>;
                  
                  return (
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
                      <div>
                        <p className="text-gray-600">Total Amount Due:</p>
                        <p className="font-medium text-orange-600">GHS {feeDetails.totalAmountDue.toFixed(2)}</p>
                      </div>
                    </div>
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
