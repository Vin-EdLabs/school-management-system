
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, Filter } from 'lucide-react';

const ViewPayments = () => {
  const { payments, students, classes } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterTerm, setFilterTerm] = useState('');

  const filteredPayments = payments.filter(payment => {
    const student = students.find(s => s.id === payment.studentId);
    if (!student) return false;

    const matchesSearch = searchTerm === '' || 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);
    
    const matchesClass = filterClass === '' || student.classAssigned === filterClass;
    const matchesTerm = filterTerm === '' || payment.term === filterTerm;

    return matchesSearch && matchesClass && matchesTerm;
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
                <SelectItem value="">All Classes</SelectItem>
                {classes.map((cls) => (
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
                <SelectItem value="">All Terms</SelectItem>
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
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No payments found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => {
                  const student = students.find(s => s.id === payment.studentId);
                  return (
                    <TableRow key={payment.id}>
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
                        <Badge variant="outline">{student?.classAssigned}</Badge>
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
        {filteredPayments.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredPayments.length} of {payments.length} payments
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ViewPayments;
