
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { Search } from 'lucide-react';

const ViewPayments = () => {
  const { payments, students, classes } = useData();
  const { currentTerm } = useActiveTerm();
=======
import useClasses from '@/hooks/useClasses';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useAcademicTerms } from '@/hooks/useAcademicTerms';

const ViewPayments = () => {
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
      receiptNumber: p.receipt_number || p.receiptNumber || ''
    };
  });

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || '')
  }));
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterTerm, setFilterTerm] = useState('all-terms');

<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
  const allPayments = Array.isArray(payments) ? payments : [];
  const filteredPayments = allPayments.filter(payment => {
    const student = (students || []).find((s: any) =>
      String(s?.id) === String(payment?.studentId) ||
      String(s?.id) === String(payment?.studentIdNum)
    );
    const matchesSearch = searchTerm === '' || (student && (
      (student.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.studentId || '').includes(searchTerm)
    ));
    const matchesClass = filterClass === 'all-classes' || !student || student.classAssigned === filterClass;
    const termsMatch = filterTerm === 'all-terms' ||
      !payment?.term ||
      payment.term === filterTerm ||
      (payment.term && filterTerm && (String(payment.term).includes(filterTerm) || String(filterTerm).includes(payment.term)));
    return matchesSearch && matchesClass && termsMatch;
=======
  const filteredPayments = payments.filter(payment => {
    const student = students.find(s => s.id === payment.studentId);
    if (!student) return false;

    const matchesSearch = searchTerm === '' ||
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);

    const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;
    const matchesTerm = filterTerm === 'all-terms' || payment.term === filterTerm;

    return matchesSearch && matchesClass && matchesTerm;
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>All Payments ({filteredPayments.length})</span>
          <Badge variant="outline" className="text-lg px-3 py-1">
            Total: GHS {totalAmount.toLocaleString()}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by class" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-classes">All Classes</SelectItem>
                {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                  <SelectItem key={cls.id} value={cls.className}>
                    {cls.className}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Term" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all-terms">All Terms</SelectItem>
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
                {currentTerm && currentTerm !== 'Not Set' && (
                  <SelectItem value={currentTerm}>{currentTerm} (Active)</SelectItem>
                )}
                <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
=======
                {(terms || []).map((t: any) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
=======
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
                    No payments found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const student = (students || []).find((s: any) =>
                    String(s?.id) === String(payment?.studentId) || String(s?.id) === String(payment?.studentIdNum)
                  );
                  return (
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
                    <TableRow key={payment.id || payment.studentId + payment.date}>
                      <TableCell>
                        <span className="font-mono text-sm">{payment.receiptNumber || '-'}</span>
=======
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {payment.receiptNumber || `-`}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
                            {student ? `${student.firstName} ${student.lastName}` : `Student #${payment.studentId || '?'}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {student?.studentId ?? payment.studentId ?? '-'}
=======
                            {student?.fullName || 'Unknown Student'}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ID: {student?.studentId || payment.studentId}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
                        <Badge variant="outline">{student?.classAssigned ?? '-'}</Badge>
=======
                        <Badge variant="outline">{student?.classAssigned || '-'}</Badge>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-green-600">
                          GHS {payment.amount.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{payment.paymentMethod}</Badge>
                      </TableCell>
                      <TableCell>{payment.term}</TableCell>
                      <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {payment.notes || '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
<<<<<<< HEAD:src/components/fees/ViewPayments.tsx
        <div className="mt-4 text-sm text-gray-600">
          {filteredPayments.length > 0
            ? `Showing ${filteredPayments.length} of ${allPayments.length} payments`
            : allPayments.length === 0
              ? 'No payments recorded yet. Record a payment in the Record Payment tab.'
              : 'No payments match your current filters. Try "All Terms" and "All Classes".'}
        </div>
=======
        {filteredPayments.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredPayments.length} of {payments.length} payments
          </div>
        )}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/ViewPayments.tsx
      </CardContent>
    </Card>
  );
};

export default ViewPayments;
