
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { formatDisplayDate } from '../../utils/dateFormat';
import { isActivePayment, paymentAmountValue, sumActivePaymentAmounts } from '../../utils/feeCalculations';
import { Search } from 'lucide-react';

const ViewPayments = () => {
  const { payments, students, classes } = useData();
  const { currentTerm } = useActiveTerm();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all-classes');
  const [filterTerm, setFilterTerm] = useState('all-terms');
  const [showVoided, setShowVoided] = useState(false);

  const allPayments = Array.isArray(payments) ? payments : [];

  const filteredPayments = useMemo(() => allPayments.filter((payment) => {
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
  }), [allPayments, students, searchTerm, filterClass, filterTerm]);

  const activeFilteredPayments = useMemo(
    () => filteredPayments.filter(isActivePayment),
    [filteredPayments]
  );

  const displayedPayments = showVoided ? filteredPayments : activeFilteredPayments;

  const totalAmount = useMemo(
    () => sumActivePaymentAmounts(filteredPayments),
    [filteredPayments]
  );

  const voidedHiddenCount = filteredPayments.length - activeFilteredPayments.length;

  const renderStatusBadge = (payment: (typeof allPayments)[number]) => {
    if (payment.isVoided) {
      return <Badge variant="destructive">VOIDED</Badge>;
    }
    if (payment.correctsPaymentId) {
      return <Badge className="bg-emerald-600 hover:bg-emerald-600">CORRECTED</Badge>;
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>
            {showVoided ? 'All Payments' : 'Active Payments'} ({displayedPayments.length})
          </span>
          <Badge variant="outline" className="text-lg px-3 py-1 w-fit">
            Total: GHS {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by student name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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

        <div className="mb-4 flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
          <Switch
            id="show-voided-payments"
            checked={showVoided}
            onCheckedChange={setShowVoided}
          />
          <Label htmlFor="show-voided-payments" className="cursor-pointer text-sm font-normal">
            Show voided receipts
          </Label>
          {!showVoided && voidedHiddenCount > 0 && (
            <span className="text-xs text-muted-foreground ml-auto">
              {voidedHiddenCount} voided receipt{voidedHiddenCount === 1 ? '' : 's'} hidden
            </span>
          )}
        </div>

        {/* Payments Table */}
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Receipt #</TableHead>
                <TableHead>Status</TableHead>
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
              {displayedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {filteredPayments.length === 0
                      ? 'No payments found matching your criteria'
                      : showVoided
                        ? 'No payments found matching your criteria'
                        : 'No active payments found. Turn on "Show voided receipts" to view voided history.'}
                  </TableCell>
                </TableRow>
              ) : (
                displayedPayments.map((payment) => {
                  const student = (students || []).find((s: any) =>
                    String(s?.id) === String(payment?.studentId) || String(s?.id) === String(payment?.studentIdNum)
                  );
                  const voided = payment.isVoided;
                  const displayAmount = paymentAmountValue(payment);
                  return (
                    <TableRow key={payment.id || payment.studentId + payment.date} className={voided ? 'opacity-70' : undefined}>
                      <TableCell>
                        <span className="font-mono text-sm">{payment.receiptNumber || '-'}</span>
                      </TableCell>
                      <TableCell>{renderStatusBadge(payment)}</TableCell>
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
                        <span className={`font-mono font-bold ${voided ? 'line-through text-muted-foreground' : 'text-green-600'}`}>
                          GHS {displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        <div className="mt-4 text-sm text-gray-600 space-y-1">
          <p>
            Total reflects active receipts only (voided receipts excluded).
            {showVoided && voidedHiddenCount > 0 && (
              <> Showing {voidedHiddenCount} voided receipt{voidedHiddenCount === 1 ? '' : 's'} for audit history.</>
            )}
          </p>
          {displayedPayments.length > 0
            ? `Showing ${displayedPayments.length} of ${allPayments.length} payments`
            : allPayments.length === 0
              ? 'No payments recorded yet. Record a payment in the Record Payment tab.'
              : 'No payments match your current filters. Try "All Terms" and "All Classes".'}
        </div>
      </CardContent>
    </Card>
  );
};

export default ViewPayments;
