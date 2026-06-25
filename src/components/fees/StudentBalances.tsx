
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useData } from '../../contexts/DataContext';
import { useAuth } from '../../contexts/AuthContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { Search, AlertCircle, CreditCard, TrendingUp } from 'lucide-react';
import { getActiveAcademicTerm } from '../../utils/feeCalculations';
import { isActiveEnrolledStudent } from '../students/studentRegistryUtils';
import { formatDisplayDate } from '../../utils/dateFormat';
import type { StudentBalance } from '../../services/studentBalance';
import type { Payment } from '../../contexts/DataContext';
import TermBillBreakdown from './TermBillBreakdown';
import { resolveFeeStructureId } from '../../services/feeStructureItems';
import { GenerateInvoiceBulkButton, GenerateInvoiceButton } from '../invoices/GenerateInvoiceActions';

const StudentBalances = () => {
  const { students, payments, classes, ledgerBalances, feeStructures } = useData();
  const { hasAccess } = useAuth();
  const { currentTerm: activeTerm, activeAcademicTermId } = useActiveTerm();
  const canGenerateInvoice = hasAccess('invoices');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterStatus, setFilterStatus] = useState('all-status');

  const currentTerm = activeTerm || getActiveAcademicTerm();

  const classRow = filterClass !== 'all-classes' ? classes.find((c) => c.className === filterClass) : null;

  const normalizeClassName = (name: string) =>
    String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');

  const feeStructureMatchesStudent = (
    fee: { classId?: number | string | null; class_id?: number | string | null; className?: string; class_name?: string; term?: string },
    student: { classAssignedId?: number | string | null; classAssigned?: string }
  ) => {
    const feeClassId = fee.classId ?? fee.class_id;
    const feeClassName = fee.className ?? fee.class_name ?? '';
    const studentClassName = student.classAssigned ?? '';
    const classMatchById =
      student.classAssignedId != null &&
      feeClassId != null &&
      Number(feeClassId) === Number(student.classAssignedId);
    const classMatchByName =
      normalizeClassName(feeClassName) !== '' &&
      normalizeClassName(feeClassName) === normalizeClassName(studentClassName);
    const classMatch = classMatchById || classMatchByName;
    const term = String(fee.term || '').trim();
    return (
      classMatch &&
      (term === currentTerm || term.startsWith(currentTerm) || currentTerm.startsWith(term))
    );
  };

  const getMatchingFeeStructureBaseAmount = (
    student: { classAssigned?: string; classAssignedId?: number | string | null },
    feeStructures: any[],
    term: string | null
  ) => {
    if (!term || term === 'Not Set') return 0;
    return feeStructures
      .filter((f) => feeStructureMatchesStudent(f, student))
      .reduce((sum, fee) => sum + (Number(fee.amount) || 0), 0);
  };

  const formatBeneficiaryDiscountLabel = (student: { isBeneficiary?: boolean; discountType?: string; discountValue?: number }) => {
    if (!student?.isBeneficiary) return null;
    const type = String(student.discountType ?? '').trim().toLowerCase();
    const value = Number(student.discountValue) || 0;
    if (!type) return 'Beneficiary Discount (100%)';
    if (type === 'percentage') return `Beneficiary Discount (${value}%)`;
    if (type === 'fixed') return `Beneficiary Discount (GHS ${value.toLocaleString()})`;
    return 'Beneficiary Discount';
  };

  const getBeneficiaryDiscountDetails = (
    student: { isBeneficiary?: boolean; discountType?: string; discountValue?: number; classAssigned?: string; classAssignedId?: number | string | null },
    feeStructures: any[],
    term: string | null
  ) => {
    if (!student?.isBeneficiary) {
      return { discountAmount: 0, discountLabel: undefined };
    }

    const baseFee = getMatchingFeeStructureBaseAmount(student, feeStructures, term);
    const type = String(student.discountType ?? '').trim().toLowerCase();
    const value = Number(student.discountValue) || 0;

    if (!type) {
      return { discountAmount: roundMoney(baseFee), discountLabel: formatBeneficiaryDiscountLabel(student) };
    }

    if (type === 'percentage') {
      const percent = Math.min(100, Math.max(0, value));
      return { discountAmount: roundMoney((baseFee * percent) / 100), discountLabel: formatBeneficiaryDiscountLabel(student) };
    }

    if (type === 'fixed') {
      return { discountAmount: roundMoney(Math.min(baseFee, value)), discountLabel: formatBeneficiaryDiscountLabel(student) };
    }

    return { discountAmount: roundMoney(baseFee), discountLabel: formatBeneficiaryDiscountLabel(student) };
  };

  const hasFeeStructureForStudent = (student: { classAssignedId?: number | string | null; classAssigned?: string }) => {
    if (!currentTerm || currentTerm === 'Not Set') return false;
    return (feeStructures || []).some((f) => feeStructureMatchesStudent(f, student));
  };

  const roundMoney = (value: number) => Math.round(value * 100) / 100;

  const currentTermPayments = useMemo(() => {
    const activeTermId = Object.values(ledgerBalances || {})[0]?.activeTermId ?? null;
    return (payments || []).filter((p: Payment) => {
      if (activeTermId != null && p.termId != null) return p.termId === activeTermId;
      return !currentTerm || p.term === currentTerm || (p.term || '').startsWith(currentTerm);
    });
  }, [payments, ledgerBalances, currentTerm]);

  const countTermPayments = (studentId: string | number) =>
    currentTermPayments.filter((p) => String(p.studentId) === String(studentId)).length;

  const calculateStudentBalance = (student: any, balance: StudentBalance | undefined) => {
    const termNotConfigured = !currentTerm || currentTerm === 'Not Set';

    if (termNotConfigured) {
      return {
        ...student,
        currentTermFee: 0,
        arrears: 0,
        creditBalance: 0,
        totalAmountDue: 0,
        totalPaid: 0,
        balance: 0,
        feeStatus: { status: 'Not Set', balance: 0 },
        paymentCount: 0,
        individualCharges: 0,
        individualChargeLines: [],
      };
    }

    if (!balance) {
      return {
        ...student,
        currentTermFee: 0,
        arrears: 0,
        creditBalance: 0,
        totalAmountDue: 0,
        totalPaid: 0,
        balance: 0,
        feeStatus: { status: 'No Fee Set', balance: 0 },
        feeStructureMissing: true,
        paymentCount: countTermPayments(student.id),
        individualCharges: 0,
        individualChargeLines: [],
      };
    }

    if (balance.status === 'NotSet') {
      const discountDetails = getBeneficiaryDiscountDetails(student, feeStructures || [], currentTerm);
      return {
        ...student,
        currentTermFee: balance.currentTermFee,
        arrears: balance.totalArrears,
        creditBroughtForward: balance.creditBroughtForward ?? 0,
        creditBalance: balance.credit,
        totalAmountDue: balance.totalDue,
        totalPaid: balance.totalPaid,
        balance: 0,
        feeStatus: { status: 'No Fee Set', balance: 0 },
        feeStructureMissing: !hasFeeStructureForStudent(student),
        paymentCount: countTermPayments(student.id),
        individualCharges: balance.individualCharges ?? 0,
        individualChargeLines: balance.individualChargeLines ?? [],
        discountAmount: discountDetails.discountAmount,
        discountLabel: discountDetails.discountLabel,
      };
    }

    const netBalance = balance.netBalance ?? 0;
    const outstanding = balance.outstanding;
    const hasFeeStructure = hasFeeStructureForStudent(student);
    const feeStructureMissing = !hasFeeStructure && balance.currentTermFee <= 0;
    const termFeePosted = balance.currentTermFee > 0;

    let feeStatus: { status: string; balance: number };
    if (!termFeePosted && balance.totalPaid <= 0 && balance.totalDue <= 0 && balance.credit <= 0) {
      feeStatus = { status: 'No Fee Set', balance: 0 };
    } else if (netBalance < -0.001) {
      feeStatus = { status: 'Credit', balance: balance.credit > 0 ? balance.credit : Math.abs(netBalance) };
    } else if (Math.abs(netBalance) < 0.001) {
      feeStatus = { status: 'Paid', balance: 0 };
    } else if (netBalance > 0 && balance.totalPaid > 0) {
      feeStatus = { status: 'Partially Paid', balance: outstanding };
    } else if (netBalance > 0 && balance.totalArrears > 0 && balance.totalPaid === 0) {
      feeStatus = { status: 'Outstanding + Arrears', balance: outstanding };
    } else if (netBalance > 0) {
      feeStatus = { status: 'Outstanding', balance: outstanding };
    } else {
      feeStatus = { status: 'Paid', balance: 0 };
    }

    const discountDetails = getBeneficiaryDiscountDetails(student, feeStructures || [], currentTerm);
    return {
      ...student,
      currentTermFee: balance.currentTermFee,
      arrears: balance.totalArrears,
      creditBroughtForward: balance.creditBroughtForward ?? 0,
      creditBalance: balance.credit,
      totalAmountDue: balance.totalDue,
      totalPaid: balance.totalPaid,
      balance: outstanding,
      netBalance,
      feeStatus,
      feeStructureMissing,
      paymentCount: countTermPayments(student.id),
      individualCharges: balance.individualCharges ?? 0,
      individualChargeLines: balance.individualChargeLines ?? [],
      discountAmount: discountDetails.discountAmount,
      discountLabel: discountDetails.discountLabel,
    };
  };

  const studentsWithBalances = useMemo(() => {
    return (students || [])
      .filter(isActiveEnrolledStudent)
      .filter((student) => {
        if (!classRow) return true;
        return String(student.classAssignedId) === String(classRow.id) || student.classAssigned === classRow.className;
      })
      .map((student) => calculateStudentBalance(student, ledgerBalances[String(student.id)]));
  }, [students, ledgerBalances, classRow, currentTerm, currentTermPayments, feeStructures]);

  const filteredStudents = studentsWithBalances.filter(student => {
    const matchesSearch = searchTerm === '' || 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.studentId.includes(searchTerm);
    
    const matchesClass = filterClass === 'all-classes' || student.classAssigned === filterClass;
    
    const matchesStatus = filterStatus === 'all-status' || 
      (filterStatus === 'outstanding' && student.balance > 0) ||
      (filterStatus === 'paid' && student.balance === 0 && student.creditBalance === 0 && student.feeStatus?.status === 'Paid') ||
      (filterStatus === 'partial' && student.feeStatus?.status === 'Partially Paid') ||
      (filterStatus === 'credit' && (student.creditBalance > 0 || (student.netBalance ?? 0) < -0.001)) ||
      (filterStatus === 'no-fee' && (student.feeStatus?.status === 'No Fee Set' || student.feeStatus?.status === 'Not Set')) ||
      (filterStatus === 'arrears' && student.arrears > 0);

    return matchesSearch && matchesClass && matchesStatus;
  });

  const totalOutstanding = filteredStudents.reduce(
    (sum, student) => sum + (student.balance > 0 ? student.balance : 0),
    0
  );
  const studentsWithOutstanding = filteredStudents.filter((student) => student.balance > 0).length;
  const totalArrears = filteredStudents.reduce(
    (sum, student) => sum + (student.arrears > 0 ? student.arrears : 0),
    0
  );
  const studentsWithArrears = filteredStudents.filter((student) => student.arrears > 0).length;
  const totalCreditBalance = filteredStudents.reduce(
    (sum, student) => sum + (student.creditBalance > 0 ? student.creditBalance : 0),
    0
  );
  const studentsWithCredit = filteredStudents.filter((student) => student.creditBalance > 0).length;

  const getStatusBadge = (student: any) => {
    const status = student.feeStatus?.status;
    if (status === 'Not Set') return <Badge variant="secondary">Not Set</Badge>;
    if (status === 'No Fee Set') {
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="secondary" className="flex items-center gap-1 border-amber-400 text-amber-800 bg-amber-50">
            <AlertCircle className="w-3 h-3" />
            No Fee Set
          </Badge>
          {student.feeStructureMissing ? (
            <span className="text-[10px] text-amber-700 leading-tight">No term fee posted for this class/term</span>
          ) : null}
        </div>
      );
    }
    if (status === 'Credit' || (student.netBalance ?? 0) < -0.001 || student.creditBalance > 0) {
      return <Badge variant="default" className="bg-green-600">Credit</Badge>;
    }
    if (status === 'Partially Paid' || (student.balance > 0 && student.totalPaid > 0)) {
      return (
        <Badge variant="outline" className="border-amber-500 text-amber-700">
          Partially Paid
        </Badge>
      );
    }
    if (status === 'Outstanding' || status === 'Outstanding + Arrears' || (student.balance > 0 && student.totalPaid === 0)) {
      const hasArrears = student.arrears > 0;
      return (
        <div className="flex flex-col items-start gap-1">
          <Badge variant="destructive" className="flex items-center space-x-1">
            <AlertCircle className="w-3 h-3" />
            <span>{hasArrears ? 'Outstanding + Arrears' : 'Outstanding'}</span>
          </Badge>
          {student.feeStructureMissing ? (
            <span className="text-[10px] text-amber-700 leading-tight">No fee set for this class/term</span>
          ) : null}
        </div>
      );
    }
    return <Badge variant="default" className="bg-green-500">Paid</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <span>Student Balances - {currentTerm}</span>
          <div className="flex flex-wrap items-center gap-2">
            {canGenerateInvoice ? (
              <GenerateInvoiceBulkButton
                termId={activeAcademicTermId}
                classes={classes.map((c) => ({ id: c.id, className: c.className }))}
              />
            ) : null}
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
              <SelectItem value="no-fee">Not Set / No Fee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Total Term Bill</TableHead>
                <TableHead>Arrears</TableHead>
                <TableHead>Credit</TableHead>
                <TableHead>Total Due</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payments</TableHead>
                {canGenerateInvoice ? <TableHead className="text-right">Invoice</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow className="border-border">
                  <TableCell colSpan={canGenerateInvoice ? 11 : 10} className="text-center py-8 text-muted-foreground">
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
                      <TermBillBreakdown
                        total={student.currentTermFee ?? 0}
                        feeStructureId={resolveFeeStructureId(
                          feeStructures || [],
                          student.classAssigned,
                          student.classAssignedId,
                          currentTerm
                        )}
                        individualCharges={student.individualChargeLines}
                        individualChargeAmount={student.individualCharges}
                        studentId={student.id}
                        termId={student.activeTermId}
                        compact
                        discountAmount={student.discountAmount}
                        discountLabel={student.discountLabel}
                      />
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono ${
                        (student.arrears ?? 0) > 0 ? 'text-amber-600 font-bold' : 'text-gray-500'
                      }`}>
                        GHS {(student.arrears ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`font-mono ${
                        (student.creditBalance ?? 0) > 0 ? 'text-green-600 font-bold' : 'text-gray-500'
                      }`}>
                        GHS {(student.creditBalance ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-foreground">
                        GHS {Math.max(0, student.totalAmountDue ?? 0).toLocaleString()}
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
                        GHS {Math.max(0, student.balance ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(student)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {student.paymentCount} payment{student.paymentCount !== 1 ? 's' : ''}
                      </Badge>
                    </TableCell>
                    {canGenerateInvoice ? (
                      <TableCell className="text-right">
                        <GenerateInvoiceButton
                          studentId={Number(student.id)}
                          studentName={`${student.firstName} ${student.lastName}`}
                          termId={student.activeTermId ?? activeAcademicTermId}
                        />
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

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
