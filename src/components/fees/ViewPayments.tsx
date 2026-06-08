
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { formatDisplayDate } from '../../utils/dateFormat';
import { Search } from 'lucide-react';

const ViewPayments = () => {
  const { payments, students, classes } = useData();
  const { currentTerm } = useActiveTerm();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterTerm, setFilterTerm] = useState('all-terms');

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
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
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
                {currentTerm && currentTerm !== 'Not Set' && (
                  <SelectItem value={currentTerm}>{currentTerm} (Active)</SelectItem>
                )}
                <SelectItem value="Term 1 2024">Term 1 2024</SelectItem>
                <SelectItem value="Term 2 2024">Term 2 2024</SelectItem>
                <SelectItem value="Term 3 2024">Term 3 2024</SelectItem>
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
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No payments found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const student = (students || []).find((s: any) =>
                    String(s?.id) === String(payment?.studentId) || String(s?.id) === String(payment?.studentIdNum)
                  );
                  return (
                    <TableRow key={payment.id || payment.studentId + payment.date}>
                      <TableCell>
                        <span className="font-mono text-sm">{payment.receiptNumber || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {student ? `${student.firstName} ${student.lastName}` : `Student #${payment.studentId || '?'}`}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {student?.studentId ?? payment.studentId ?? '-'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{student?.classAssigned ?? '-'}</Badge>
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
                      <TableCell>{formatDisplayDate(payment.date)}</TableCell>
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
        <div className="mt-4 text-sm text-gray-600">
          {filteredPayments.length > 0
            ? `Showing ${filteredPayments.length} of ${allPayments.length} payments`
            : allPayments.length === 0
              ? 'No payments recorded yet. Record a payment in the Record Payment tab.'
              : 'No payments match your current filters. Try "All Terms" and "All Classes".'}
        </div>
      </CardContent>
    </Card>
  );
};

export default ViewPayments;
