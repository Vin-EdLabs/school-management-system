import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { getActiveAcademicTerm, calculateStudentFeesSync, calculateStudentFeeStatusSync } from '../../utils/feeCalculations';

const StudentBalances = () => {
  const { students, payments, feeStructures, classes, arrearsBalances } = useData();
  const { currentTerm: activeTerm } = useActiveTerm();
=======
import useClasses from '@/hooks/useClasses';
import useFeeStructures from '@/hooks/useFeeStructures';
import usePayments from '@/hooks/usePayments';
import useStudents from '@/hooks/useStudents';
import { AlertCircle, CreditCard, Search, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { calculateStudentFees, calculateStudentFeeStatus } from '../../utils/feeCalculations';
import { useActiveTerm } from '@/hooks/useSettings';
import { useBalances } from '@/hooks/useBalances';

const StudentBalances = () => {
  const { students: rawStudents } = useStudents();
  const { payments: rawPayments } = usePayments();
  const { feeStructures: rawFeeStructures } = useFeeStructures();
  const { classes: rawClasses } = useClasses();

  const { data: activeTermData, isLoading: termLoading } = useActiveTerm();
  const currentTermId = activeTermData?.id;
  const currentTermName = activeTermData?.name || 'Term 1';

  const { arrearsMap, creditMap, isLoading: balancesLoading } = useBalances(currentTermId);
  const isDataLoading = balancesLoading || termLoading;

  const students = (rawStudents || []).map((s: any) => {
    const id = String(s.id ?? s.student_id ?? '');
    const firstName = s.first_name || s.firstName || '';
    const lastName = s.last_name || s.lastName || '';
    const studentId = String(s.admission_no || s.studentId || s.id || '');

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
      studentId,
      classAssigned,
      classId: s.class_id || s.classId
    };
  });

  const payments = (rawPayments || []).map((p: any) => ({
    ...p,
    id: p.id ?? String(p.id),
    studentId: String(p.student_id || p.studentId || p.student),
    term: p.term || p.term_name || p.termName || '',
    term_id: p.term_id || p.termId,
    amount: Number(p.amount || 0)
  }));

  const feeStructures = (rawFeeStructures || []).map((f: any) => ({
    ...f,
    id: f.id ?? String(f.id),
    className: f.name || f.className || f.class_name || '',
    class_id: f.class_id || f.classId,
    term: f.term || f.term_name || f.termName || '',
    term_id: f.term_id || f.academicTermId || f.termId,
    amount: Number(f.items?.amount || f.amount || 0),
    description: f.items?.description || f.description || ''
  }));

  const classes = (rawClasses || []).map((c: any) => ({
    id: c.id ?? String(c.id),
    className: c.level && c.stream ? `${c.level} ${c.stream}` : (c.level || c.className || c.class_name || c.name || ''),
    maxClassSize: c.maxClassSize ?? c.max_class_size ?? c.capacity ?? 30
  }));
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterStatus, setFilterStatus] = useState('all-status');

<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
  const currentTerm = activeTerm || getActiveAcademicTerm();

  // Calculate comprehensive balance for each student (sync - uses local data)
=======
  // Calculate comprehensive balance for each student
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
  const calculateStudentBalance = (student: any) => {
    const feeCalculation = calculateStudentFeesSync(
      student.id,
      activeTermData,
      student.classAssigned,
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
      feeStructures || [],
      payments || [],
      student.classAssignedId,
      arrearsBalances
=======
      feeStructures,
      payments,
      arrearsMap,
      creditMap
    );

    const feeStatus = calculateStudentFeeStatus(
      student.id,
      activeTermData,
      students,
      feeStructures,
      payments,
      arrearsMap,
      creditMap
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
    );
    const feeStatus = calculateStudentFeeStatusSync(feeCalculation);
    const balance = Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid);

    return {
      ...student,
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
      currentTermFee: feeCalculation.currentTermFee ?? 0,
      arrears: feeCalculation.arrears ?? 0,
      creditBalance: feeCalculation.creditBalance ?? 0,
      totalAmountDue: feeCalculation.totalAmountDue ?? 0,
      totalPaid: feeCalculation.totalPaid ?? 0,
      balance,
      feeStatus,
      paymentCount: (payments || []).filter((p: any) => String(p.studentId) === String(student.id) && (p.term === currentTerm || p.term?.includes?.(currentTerm))).length
=======
      currentTermFee: feeCalculation.currentTermFee,
      arrears: feeCalculation.arrears,
      creditBalance: feeCalculation.creditBalance,
      totalAmountDue: feeCalculation.totalAmountDue,
      totalPaid: feeCalculation.totalPaid,
      balance: feeCalculation.remainingBalance,
      feeStatus: feeStatus,
      paymentCount: payments.filter(p => {
        const isStudent = String(p.studentId || p.student_id) === String(student.id);
        const pTermId = p.term_id || p.termId;
        const pTermName = p.term || p.term_name || p.termName;

        const termMatches = (
          (activeTermData?.id && pTermId && String(pTermId) === String(activeTermData.id)) ||
          (pTermName && pTermName === currentTermName)
        );

        return isStudent && termMatches;
      }).length
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
    };
  };

  const studentsWithBalances = (students || []).map(calculateStudentBalance);

  const filteredStudents = studentsWithBalances.filter(student => {
    const q = (searchTerm || '').toLowerCase().trim();
    const matchesSearch =
      !q ||
      (student.firstName || '').toLowerCase().includes(q) ||
      (student.lastName || '').toLowerCase().includes(q) ||
      String(student.studentId || '').toLowerCase().includes(q);

    const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;

    const matchesStatus = filterStatus === 'all-status' ||
      (filterStatus === 'outstanding' && student.balance > 0) ||
      (filterStatus === 'paid' && (student.balance === 0 && student.feeStatus?.status === 'Paid')) ||
      (filterStatus === 'partial' && student.feeStatus?.status === 'Partially Paid') ||
      (filterStatus === 'credit' && student.feeStatus?.status === 'Credit Balance') ||
      (filterStatus === 'no-fee' && student.feeStatus?.status === 'No Fee Set') ||
      (filterStatus === 'arrears' && student.arrears > 0);

    return matchesSearch && matchesClass && matchesStatus;
  });

  // Calculate summary statistics
  const totalOutstanding = filteredStudents.reduce((sum, student) => sum + student.balance, 0);
  const studentsWithOutstanding = filteredStudents.filter(student => student.balance > 0).length;
  const totalArrears = filteredStudents.reduce((sum, student) => sum + student.arrears, 0);
  const studentsWithArrears = filteredStudents.filter(student => student.arrears > 0).length;
  const totalCreditBalance = filteredStudents
    .filter(student => student.feeStatus?.status === 'Credit Balance')
    .reduce((sum, student) => sum + Math.abs(student.feeStatus?.balance ?? 0), 0);
  const studentsWithCredit = filteredStudents.filter(student => student.feeStatus?.status === 'Credit Balance').length;

  const getStatusBadge = (student: any) => {
    const status = student.feeStatus?.status;
    if (status === 'No Fee Set') return <Badge variant="secondary">No Fee Set</Badge>;
    if (status === 'Credit Balance' || (student.creditBalance > 0 && student.balance <= 0)) {
      return <Badge variant="default" className="bg-blue-500">Credit Balance</Badge>;
    }
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
    if (status === 'Partially Paid' || (student.balance > 0 && student.totalPaid > 0)) {
=======

    if (student.feeStatus.status === 'Credit Balance') {
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          Partially Paid
        </Badge>
      );
    }
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
    if (status === 'Unpaid' || (student.balance > 0 && student.totalPaid === 0)) {
=======

    if (student.balance > 0) {
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
      const hasArrears = student.arrears > 0;
      return (
        <Badge variant="destructive" className="flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{hasArrears ? 'Outstanding + Arrears' : 'Unpaid'}</span>
        </Badge>
      );
    }
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
    return <Badge variant="default" className="bg-green-500">Paid</Badge>;
=======

    return (
      <Badge variant="default" className="bg-green-500">
        Fully Paid
      </Badge>
    );
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Student Balances - {currentTermName}</span>
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
        {isDataLoading && (
          <div className="mb-4 p-4 bg-blue-50 text-blue-700 rounded-lg flex items-center justify-center space-x-2 animate-pulse">
            <TrendingUp className="w-5 h-5 animate-bounce" />
            <span className="font-medium text-lg">Loading and calculating student balances...</span>
          </div>
        )}
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
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
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
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partially Paid</SelectItem>
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
                <TableHead>Money Left</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                        <div className="text-sm text-muted-foreground">
                          ID: {student.studentId}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{student.classAssigned}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">
                        GHS {(student.currentTermFee ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
                      <span className={`font-mono ${
                        (student.arrears ?? 0) > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'
                      }`}>
                        GHS {(student.arrears ?? 0).toLocaleString()}
=======
                      <span className={`font-mono ${student.arrears > 0 ? 'text-amber-600 font-bold' : 'text-muted-foreground'
                        }`}>
                        GHS {student.arrears.toLocaleString()}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold">
                        GHS {(student.totalAmountDue ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-green-600">
                        GHS {(student.totalPaid ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
<<<<<<< HEAD:src/components/fees/StudentBalances.tsx
                      <span className={`font-mono font-bold ${
                        (student.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        GHS {(student.balance ?? 0).toLocaleString()}
=======
                      <span className={`font-mono font-bold ${student.balance > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                        GHS {student.balance.toLocaleString()}
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/fees/StudentBalances.tsx
                      </span>
                      {student.feeStatus?.status === 'Credit Balance' && (
                        <div className="text-xs text-blue-600 mt-1">
                          Credit: GHS {Math.abs(student.feeStatus.balance ?? 0).toLocaleString()}
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
          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-medium text-foreground">Showing {filteredStudents.length} students</p>
                <p className="text-muted-foreground">
                  {studentsWithOutstanding} have outstanding balances
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Total Outstanding: GHS {totalOutstanding.toLocaleString()}</p>
                <p className="text-muted-foreground">
                  Arrears: GHS {totalArrears.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="font-medium text-foreground">Academic Period: {currentTermName}</p>
                <p className="text-muted-foreground">
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
