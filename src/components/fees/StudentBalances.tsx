
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, AlertCircle } from 'lucide-react';

const StudentBalances = () => {
  const { students, payments, feeStructures, classes } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');

  const calculateBalance = (student: any) => {
    const studentFee = feeStructures.find(fee => fee.className === student.classAssigned);
    if (!studentFee) return 0;

    const studentPayments = payments
      .filter(payment => payment.studentId === student.id && payment.term === 'Term 1 2024')
      .reduce((sum, payment) => sum + payment.amount, 0);

    return Math.max(0, studentFee.amount - studentPayments);
  };

  const studentsWithBalances = students.map(student => ({
    ...student,
    balance: calculateBalance(student),
    totalPaid: payments
      .filter(payment => payment.studentId === student.id && payment.term === 'Term 1 2024')
      .reduce((sum, payment) => sum + payment.amount, 0),
    expectedFee: feeStructures.find(fee => fee.className === student.classAssigned)?.amount || 0
  }));

  const filteredStudents = studentsWithBalances.filter(student => {
    const matchesSearch = searchTerm === '' || 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);
    
    const matchesClass = filterClass === 'all' || student.classAssigned === filterClass;

    return matchesSearch && matchesClass;
  });

  const totalOutstanding = filteredStudents.reduce((sum, student) => sum + student.balance, 0);
  const studentsWithOutstanding = filteredStudents.filter(student => student.balance > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Student Balances</span>
          <div className="flex items-center space-x-4">
            <Badge variant="outline" className="text-sm">
              Outstanding: {studentsWithOutstanding} students
            </Badge>
            <Badge variant="destructive" className="text-sm">
              Total: GHS {totalOutstanding.toLocaleString()}
            </Badge>
          </div>
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
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by class" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.className}>
                  {cls.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Balances Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Expected Fee</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    No students found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {student.firstName} {student.lastName}
                        </div>
                        <div className="text-sm text-gray-500">
                          ID: {student.studentId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.classAssigned}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        GHS {student.expectedFee.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-green-600">
                        GHS {student.totalPaid.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-bold ${
                        student.balance > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        GHS {student.balance.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {student.balance > 0 ? (
                        <Badge variant="destructive" className="flex items-center space-x-1">
                          <AlertCircle className="w-3 h-3" />
                          <span>Outstanding</span>
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-500">
                          Paid
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredStudents.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredStudents.length} students. 
            {studentsWithOutstanding > 0 && (
              <span className="text-red-600 ml-1">
                {studentsWithOutstanding} have outstanding balances.
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentBalances;
