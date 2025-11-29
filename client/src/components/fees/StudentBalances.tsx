
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { AlertCircle, CreditCard, Search, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { calculateStudentFees, calculateStudentFeeStatus, getActiveAcademicTerm } from '../../utils/feeCalculations';

const StudentBalances = () => {
  const { students: rawStudents } = useStudents();
  const { payments: rawPayments } = usePayments();
  const { feeStructures: rawFeeStructures } = useFeeStructures();
  const { classes: rawClasses } = useClasses();

  const students = (rawStudents || []).map((s: any) => ({
    id: s.id ?? String(s.id),
    firstName: s.first_name || s.firstName || '',
    lastName: s.last_name || s.lastName || '',
    studentId: s.studentId || s.student_id || s.id || '',
    classAssigned: s.classAssigned || s.class_assigned || ''
  }));

  const payments = (rawPayments || []).map((p: any) => ({
    id: p.id ?? String(p.id),
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || p.termName || '',
    amount: Number(p.amount || 0)
  }));

  const feeStructures = (rawFeeStructures || []).map((f: any) => ({
    id: f.id ?? String(f.id),
    className: f.className || f.class_name || '',
    term: f.term || f.term_name || f.termName || '',
    amount: Number(f.amount || f.fee || 0),
    description: f.description || ''
  }));

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.className || c.class_name || c.name || '',
    maxClassSize: c.maxClassSize ?? c.max_class_size ?? c.capacity ?? 30
  }));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterStatus, setFilterStatus] = useState('all-status');

  const currentTerm = getActiveAcademicTerm();

  // Calculate comprehensive balance for each student
  const calculateStudentBalance = (student: any) => {
    const feeCalculation = calculateStudentFees(
      student.id,
      currentTerm,
      student.classAssigned,
      feeStructures,
      payments
    );

    const feeStatus = calculateStudentFeeStatus(
      student.id,
      currentTerm,
      students,
      feeStructures,
      payments
    );

    return {
      ...student,
      currentTermFee: feeCalculation.currentTermFee,
      arrears: feeCalculation.arrears,
      creditBalance: feeCalculation.creditBalance,
      totalAmountDue: feeCalculation.totalAmountDue,
      totalPaid: feeCalculation.totalPaid,
      balance: Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid),
      feeStatus: feeStatus,
      paymentCount: payments.filter(p => p.studentId === student.id && p.term === currentTerm).length
    };
  };

  const studentsWithBalances = students.map(calculateStudentBalance);

  const filteredStudents = studentsWithBalances.filter(student => {
    const matchesSearch = searchTerm === '' ||
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);

    const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;

    const matchesStatus = filterStatus === 'all-status' ||
      (filterStatus === 'outstanding' && student.balance > 0) ||
      (filterStatus === 'paid' && student.balance === 0 && student.feeStatus.status === 'Fully Paid') ||
      (filterStatus === 'credit' && student.feeStatus.status === 'Credit Balance') ||
      (filterStatus === 'no-fee' && student.feeStatus.status === 'No Fee Set') ||
      (filterStatus === 'arrears' && student.arrears > 0);

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Calculate summary statistics
  const totalOutstanding = filteredStudents.reduce((sum, student) => sum + student.balance, 0);
  const studentsWithOutstanding = filteredStudents.filter(student => student.balance > 0).length;
  const totalArrears = filteredStudents.reduce((sum, student) => sum + student.arrears, 0);
  const studentsWithArrears = filteredStudents.filter(student => student.arrears > 0).length;
  const totalCreditBalance = filteredStudents
    .filter(student => student.feeStatus.status === 'Credit Balance')
    .reduce((sum, student) => sum + Math.abs(student.feeStatus.balance), 0);
  const studentsWithCredit = filteredStudents.filter(student => student.feeStatus.status === 'Credit Balance').length;

  const getStatusBadge = (student: any) => {
    if (student.feeStatus.status === 'No Fee Set') {
      return <Badge variant="secondary">No Fee Set</Badge>;
    }

    if (student.feeStatus.status === 'Credit Balance') {
      return (
        <Badge variant="default" className="bg-blue-500">
          Credit Balance
        </Badge>
      );
    }

    if (student.balance > 0) {
      const hasArrears = student.arrears > 0;
      return (
        <Badge variant="destructive" className="flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{hasArrears ? 'Outstanding + Arrears' : 'Outstanding'}</span>
        </Badge>
      );
    }

    return (
      <Badge variant="default" className="bg-green-500">
        Fully Paid
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Student Balances - {currentTerm}</span>
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
        {/* Enhanced Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Outstanding</span>
            </div>
            <div className="text-lg font-bold text-red-600">
              {studentsWithOutstanding} students
            </div>
            <div className="text-sm text-red-600">
              GHS {totalOutstanding.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-800">Arrears</span>
            </div>
            <div className="text-lg font-bold text-amber-600">
              {studentsWithArrears} students
            </div>
            <div className="text-sm text-amber-600">
              GHS {totalArrears.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">Credit Balance</span>
            </div>
            <div className="text-lg font-bold text-blue-600">
              {studentsWithCredit} students
            </div>
            <div className="text-sm text-blue-600">
              GHS {totalCreditBalance.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Search className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Showing</span>
            </div>
            <div className="text-lg font-bold text-green-600">
              {filteredStudents.length} students
            </div>
            <div className="text-sm text-green-600">
              Filtered results
            </div>
          </div>
        </div>

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
              <SelectItem value="all-classes">All Classes</SelectItem>
              {classes.filter(cls => cls.className && cls.className.trim() !== '').map((cls) => (
                <SelectItem key={cls.id} value={cls.className}>
                  {cls.className}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">All Statuses</SelectItem>
              <SelectItem value="outstanding">Outstanding</SelectItem>
              <SelectItem value="paid">Fully Paid</SelectItem>
              <SelectItem value="credit">Credit Balance</SelectItem>
              <SelectItem value="arrears">With Arrears</SelectItem>
              <SelectItem value="no-fee">No Fee Set</SelectItem>
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
                <TableHead>Term Fee</TableHead>
                <TableHead>Arrears</TableHead>
                <TableHead>Total Due</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
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
                        GHS {student.currentTermFee.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono ${student.arrears > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'
                        }`}>
                        GHS {student.arrears.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold">
                        GHS {student.totalAmountDue.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-green-600">
                        GHS {student.totalPaid.toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-bold ${student.balance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                        GHS {student.balance.toLocaleString()}
                      </span>
                      {student.feeStatus.status === 'Credit Balance' && (
                        <div className="text-xs text-blue-600 mt-1">
                          Credit: GHS {Math.abs(student.feeStatus.balance).toLocaleString()}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(student)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {student.paymentCount} payment{student.paymentCount !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        {filteredStudents.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-800">Showing {filteredStudents.length} students</p>
                <p className="text-gray-600">
                  {studentsWithOutstanding} have outstanding balances
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Total Outstanding: GHS {totalOutstanding.toLocaleString()}</p>
                <p className="text-gray-600">
                  Arrears: GHS {totalArrears.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="font-medium text-gray-800">Academic Period: {currentTerm}</p>
                <p className="text-gray-600">
                  Generated: {new Date().toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentBalances;
