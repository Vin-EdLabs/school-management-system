
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import useClasses from '@/hooks/useClasses';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';
import { Eye, Receipt, Search } from 'lucide-react';
import { useState } from 'react';
import ReceiptPrinter from '../../components/common/ReceiptPrinter';

const ReceiptHistory = () => {
  const { payments: rawPayments } = usePayments();
  const { students: rawStudents } = useStudents();
  const { classes: rawClasses } = useClasses();
  const { terms } = useAcademicTerms();

  const students = (rawStudents || []).map((s: any) => {
    const id = String(s.id ?? s.student_id ?? '');
    const firstName = s.first_name || s.firstName || '';
    const lastName = s.last_name || s.lastName || '';
    const studentId = String(s.admission_no || s.studentId || s.id || '');
    const fullName = `${firstName} ${lastName}`.trim() || s.name || s.full_name || 'Unknown Student';

    let classAssigned = (s.class_assigned || s.classAssigned || '');
    if ((!classAssigned || classAssigned === '') && s.class_id) {
      const cls = (rawClasses || []).find((c: any) => String(c.id) === String(s.class_id));
      if (cls) {
        classAssigned = cls.level && cls.stream ? `${cls.level} ${cls.stream}` : (cls.level || cls.class_name || cls.className || cls.name || '');
      }
    }

    return {
      ...s,
      id,
      firstName,
      lastName,
      fullName,
      studentId,
      classAssigned
    };
  });

  const payments = (rawPayments || []).map((p: any) => {
    const termId = p.term_id || p.termId;
    const termName = p.term || p.term_name || p.termName || (termId ? (terms || []).find((t: any) => String(t.id) === String(termId))?.name : '');

    return {
      id: p.id ?? String(p.id),
      studentId: String(p.student_id || p.studentId || p.student),
      term: termName || '',
      amount: Number(p.amount || 0),
      paymentMethod: p.paymentMethod || p.method || p.payment_method || '',
      date: p.payment_date || p.date || p.created_at || new Date().toISOString(),
      notes: p.notes || p.description || '',
      receiptNumber: p.receipt_number || p.receiptNumber || `R-${p.id}`
    };
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [filterTerm, setFilterTerm] = useState('all-terms');
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const getReceiptNo = (payment: any) => {
    return payment.receiptNumber || `R-${payment.id}`;
  };

  const filteredPayments = payments.filter(payment => {
    const student = students.find(s => s.id === payment.studentId);
    const receiptNumber = getReceiptNo(payment);

    const matchesSearch = searchTerm === '' ||
      receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student && (
        student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.studentId.includes(searchTerm)
      ));

    const matchesTerm = filterTerm === 'all-terms' || payment.term === filterTerm;

    return matchesSearch && matchesTerm;
  });

  const handleViewReceipt = (payment: any) => {
    const student = students.find(s => s.id === payment.studentId);
    if (!student) return;

    const receiptData = {
      studentName: student.fullName,
      studentId: student.studentId,
      className: student.classAssigned,
      amount: payment.amount,
      date: payment.date,
      paymentMethod: payment.paymentMethod,
      term: payment.term,
      receiptNumber: getReceiptNo(payment),
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
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by receipt number, student name, or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterTerm} onValueChange={setFilterTerm}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="Filter by Term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-terms">All Terms</SelectItem>
                  {(terms || []).map((t: any) => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No receipts found matching your criteria
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.map((payment) => {
                      const student = students.find(s => s.id === payment.studentId);
                      const receiptNumber = getReceiptNo(payment);
                      return (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                              {receiptNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {student?.fullName || 'Unknown Student'}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {student?.studentId || payment.studentId}
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
                            <span className="text-sm font-medium text-muted-foreground">{payment.term}</span>
                          </TableCell>
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
    </>
  );
};

export default ReceiptHistory;
