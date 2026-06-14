
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { Search, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { getActiveAcademicTerm, calculateStudentFeesSync, calculateStudentFeeStatusSync } from '../../utils/feeCalculations';
import { shouldTrackStudentFees } from '../students/studentRegistryUtils';
import { formatDisplayDate } from '../../utils/dateFormat';

const StudentBalances = () => {
  const { students, payments, feeStructures, classes, arrearsBalances } = useData();
  const { currentTerm: activeTerm } = useActiveTerm();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterStatus, setFilterStatus] = useState('all-status');

  const currentTerm = activeTerm || getActiveAcademicTerm();

  // Calculate comprehensive balance for each student (sync - uses local data)
  const calculateStudentBalance = (student: any) => {
    const feeCalculation = calculateStudentFeesSync(
      student.id,
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
    const feeStatus = calculateStudentFeeStatusSync(feeCalculation);
    const balance = Math.max(0, feeCalculation.totalAmountDue - feeCalculation.totalPaid);

    return {
      ...student,
      currentTermFee: feeCalculation.currentTermFee ?? 0,
      arrears: feeCalculation.arrears ?? 0,
      creditBalance: feeCalculation.creditBalance ?? 0,
      totalAmountDue: feeCalculation.totalAmountDue ?? 0,
      totalPaid: feeCalculation.totalPaid ?? 0,
      balance,
      feeStatus,
      paymentCount: (payments || []).filter((p: any) => String(p.studentId) === String(student.id) && (p.term === currentTerm || p.term?.includes?.(currentTerm))).length
    };
  };

  const studentsWithBalances = (students || []).filter(shouldTrackStudentFees).map(calculateStudentBalance);

  const filteredStudents = studentsWithBalances.filter(student => {
    const matchesSearch = searchTerm === '' || 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);
    
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
    if (status === 'Partially Paid' || (student.balance > 0 && student.totalPaid > 0)) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          Partially Paid
        </Badge>
      );
    }
    if (status === 'Unpaid' || (student.balance > 0 && student.totalPaid === 0)) {
      const hasArrears = student.arrears > 0;
      return (
        <Badge variant="destructive" className="flex items-center space-x-1">
          <AlertCircle className="w-3 h-3" />
          <span>{hasArrears ? 'Outstanding + Arrears' : 'Unpaid'}</span>
        </Badge>
      );
    }
    return <Badge variant="default" className="bg-green-500">Paid</Badge>;
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
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">Outstanding</span>
            </div>
            <div className="text-lg font-bold text-red-600 dark:text-red-400">
              {studentsWithOutstanding} students
            </div>
            <div className="text-sm text-red-600 dark:text-red-400">
              GHS {totalOutstanding.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">Arrears</span>
            </div>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {studentsWithArrears} students
            </div>
            <div className="text-sm text-amber-600 dark:text-amber-400">
              GHS {totalArrears.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Credit Balance</span>
            </div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {studentsWithCredit} students
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">
              GHS {totalCreditBalance.toLocaleString()}
            </div>
          </div>

          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Showing</span>
            </div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {filteredStudents.length} students
            </div>
            <div className="text-sm text-emerald-600 dark:text-emerald-400">
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
              className="pl-10 bg-background border-border"
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
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No students found matching your criteria
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => (
                  <TableRow key={student.id} className="border-border hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div>
                        <div className="font-medium text-foreground flex items-center gap-2">
                          {student.firstName} {student.lastName}
                          {student.isBeneficiary && (
                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 text-[10px] h-5 px-1.5 font-bold">
                              Beneficiary
                            </Badge>
                          )}
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
                      <span className={`font-mono ${
                        (student.arrears ?? 0) > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'
                      }`}>
                        GHS {(student.arrears ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-foreground">
                        GHS {(student.totalAmountDue ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                        GHS {(student.totalPaid ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono font-bold ${
                        (student.balance ?? 0) > 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        GHS {(student.balance ?? 0).toLocaleString()}
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
          <div className="mt-4 p-4 bg-muted/50 rounded-lg border border-border">
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
                <p className="font-medium text-foreground">Academic Period: {currentTerm}</p>
                <p className="text-muted-foreground">
                  Generated: {formatDisplayDate(new Date())}
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
