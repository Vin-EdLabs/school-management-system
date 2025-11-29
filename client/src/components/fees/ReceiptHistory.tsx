
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { Eye, Receipt, Search } from 'lucide-react';
import { useState } from 'react';
import ReceiptPrinter from '../common/ReceiptPrinter';

const ReceiptHistory = () => {
  const { payments: rawPayments } = usePayments();
  const { students: rawStudents } = useStudents();
  const payments = (rawPayments || []).map((p: any) => ({
    id: p.id ?? String(p.id),
    amount: Number(p.amount || 0),
    date: p.date || p.created_at || new Date().toISOString(),
    paymentMethod: p.paymentMethod || p.method || p.payment_method || '',
    term: p.term || p.term_name || '',
    notes: p.notes || '',
    studentId: String(p.student_id || p.studentId || p.student)
  }));

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    studentId: s.studentId || s.student_id || s.id || '',
    classAssigned: s.classAssigned || s.class_assigned || ''
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  // Generate receipt numbers consistently (same logic as RecordPayment)
  const generateReceiptNumber = (paymentId: string, date: string) => {
    const timestamp = new Date(date).getTime().toString().slice(-6);
    const idHash = paymentId.slice(-3);
    return `RG${timestamp}${idHash}`;
  };

  const filteredPayments = payments.filter(payment => {
    const student = students.find(s => s.id === payment.studentId);
    const receiptNumber = generateReceiptNumber(payment.id, payment.date);

    return searchTerm === '' ||
      receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student && (
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.includes(searchTerm)
      ));
  });

  const handleViewReceipt = (payment: any) => {
    const student = students.find(s => s.id === payment.studentId);
    if (!student) return;

    const receiptData = {
      studentName: `${student.firstName} ${student.lastName}`,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: payment.amount,
      date: payment.date,
      paymentMethod: payment.paymentMethod,
      term: payment.term,
      receiptNumber: generateReceiptNumber(payment.id, payment.date),
      notes: payment.notes
    };

    setSelectedReceipt(receiptData);
    setShowReceipt(true);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Receipt className="w-5 h-5" />
            <span>Receipt History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by receipt number, student name, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No receipts found matching your search
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const student = students.find(s => s.id === payment.studentId);
                      const receiptNumber = generateReceiptNumber(payment.id, payment.date);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                              {receiptNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {student?.firstName} {student?.lastName}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: {student?.studentId}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-green-600">
                              GHS {payment.amount.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{payment.paymentMethod}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewReceipt(payment)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {filteredPayments.length > 0 && (
              <div className="text-sm text-gray-600">
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
    </>
  );
};

export default ReceiptHistory;
