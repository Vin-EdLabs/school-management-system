import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RecordPayment from './RecordPayment';
import ViewPayments from './ViewPayments';
import SetFeeStructure from './SetFeeStructure';
import StudentBalances from './StudentBalances';
import ReceiptHistory from './ReceiptHistory';
import OutstandingFees from './OutstandingFees';
import ConfirmDialog from '../common/ConfirmDialog';
import { apiService } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { toast } from '@/hooks/use-toast';
import { CreditCard, DollarSign, Eye, Users, Receipt, AlertCircle, Trash2, RefreshCw, ArrowRightCircle } from 'lucide-react';

interface AcademicTermOption {
  termLabel: string;   // e.g. "Term 1 2027"
  isCurrent: boolean;
}

const FeesModule = () => {
  const { refresh } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const [activeTab, setActiveTab] = useState('record-payment');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Carry arrears state
  const [termOptions, setTermOptions] = useState<AcademicTermOption[]>([]);
  const [selectedPrevTerm, setSelectedPrevTerm] = useState<string>('');
  const [carryingArrears, setCarryingArrears] = useState(false);

  // Current term full string e.g. "Term 2 2027"
  const currentTermFull = currentTerm && currentYear
    ? `${currentTerm} ${currentYear}`.trim()
    : currentTerm || '';

  // Load academic terms from settings table
  useEffect(() => {
    apiService.get('/settings/academic-terms')
      .then((data: any[]) => {
        if (!Array.isArray(data)) return;
        // Build "Term X YEAR" labels; exclude the current active term
        const options: AcademicTermOption[] = data.map(t => {
          const label = `${t.term_name} ${t.year}`.trim();
          return { termLabel: label, isCurrent: t.is_active };
        });
        setTermOptions(options);
        // Auto-select the most recent non-current term
        const others = options.filter(o => !o.isCurrent);
        if (others.length > 0) setSelectedPrevTerm(others[0].termLabel);
      })
      .catch(() => {});
  }, []);

  const previousTermOptions = termOptions.filter(t => t.termLabel !== currentTermFull && !t.isCurrent);

  const handleCarryArrears = async () => {
    if (!selectedPrevTerm) {
      toast({ title: 'Select previous term', description: 'Choose the term whose outstanding balance should become arrears.', variant: 'destructive' });
      return;
    }
    if (!currentTermFull) {
      toast({ title: 'No active term', description: 'Set an active term in Settings first.', variant: 'destructive' });
      return;
    }
    setCarryingArrears(true);
    try {
      const result: any = await apiService.post('/finance/carry-arrears', { previousTerm: selectedPrevTerm });
      const total = result.arrearsRowsInserted ?? 0;
      toast({
        title: total > 0 ? 'Arrears carried successfully' : 'No arrears to carry',
        description: total > 0
          ? `${total} student(s) now have arrears from "${result.previousTerm}" in "${result.currentTerm}".`
          : `No students had an outstanding balance in "${result.previousTerm}".`,
      });
      await refresh();
    } catch (err: any) {
      toast({
        title: 'Failed to carry arrears',
        description: err?.message || 'An error occurred.',
        variant: 'destructive',
      });
    } finally {
      setCarryingArrears(false);
    }
  };

  const handleClearAllPayments = async () => {
    setClearing(true);
    try {
      await apiService.post('/finance/clear-all-payments');
      toast({
        title: 'Cleared',
        description: 'All payments and receipts for this school have been cleared. Receipt numbers will start from 1 again.',
      });
      setShowClearConfirm(false);
      await refresh();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.message || 'Failed to clear payments and receipts',
        variant: 'destructive',
      });
    } finally {
      setClearing(false);
    }
  };


  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fees Management</h1>
            <p className="text-muted-foreground">Manage school fees, payments, and financial records</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-6">
          <TabsTrigger value="record-payment" className="flex items-center space-x-2">
            <CreditCard className="w-4 h-4" />
            <span>Record Payment</span>
          </TabsTrigger>
          <TabsTrigger value="view-payments" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View Payments</span>
          </TabsTrigger>
          <TabsTrigger value="receipts" className="flex items-center space-x-2">
            <Receipt className="w-4 h-4" />
            <span>Receipts</span>
          </TabsTrigger>
          <TabsTrigger value="balances" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Student Balances</span>
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4" />
            <span>Outstanding Fees</span>
          </TabsTrigger>
          <TabsTrigger value="fee-structure" className="flex items-center space-x-2">
            <DollarSign className="w-4 h-4" />
            <span>Fee Structure</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="record-payment">
          <RecordPayment />
        </TabsContent>

        <TabsContent value="view-payments">
          <ViewPayments />
        </TabsContent>

        <TabsContent value="receipts">
          <ReceiptHistory />
        </TabsContent>

        <TabsContent value="balances">
          <StudentBalances />
        </TabsContent>

        <TabsContent value="outstanding">
          <OutstandingFees />
        </TabsContent>

        <TabsContent value="fee-structure">
          <SetFeeStructure />
        </TabsContent>
      </Tabs>

      {/* Carry Arrears card */}
      <Card className="mt-6 border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-blue-800">
            <ArrowRightCircle className="w-4 h-4" />
            Carry arrears to current term
          </CardTitle>
          <CardContent className="pt-1">
            <p className="text-sm text-blue-800/90 mb-4">
              Pick the <strong>previous term</strong> whose unpaid balances should become arrears in
              {currentTermFull ? <strong> {currentTermFull}</strong> : ' the current term'}.
              Safe to run multiple times — existing arrears are updated, not duplicated.
            </p>
            {previousTermOptions.length === 0 ? (
              <p className="text-sm text-blue-600 italic">
                {termOptions.length === 0
                  ? 'No academic terms found. Create terms in Settings first.'
                  : 'Only one term exists — nothing to carry forward yet.'}
              </p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={selectedPrevTerm} onValueChange={setSelectedPrevTerm}>
                  <SelectTrigger className="w-64 bg-white border-blue-300 text-blue-900">
                    <SelectValue placeholder="Select previous term" />
                  </SelectTrigger>
                  <SelectContent>
                    {previousTermOptions.map(t => (
                      <SelectItem key={t.termLabel} value={t.termLabel}>
                        {t.termLabel}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleCarryArrears}
                  disabled={carryingArrears || !selectedPrevTerm || !currentTermFull}
                >
                  {carryingArrears ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Carrying…</>
                  ) : (
                    <><ArrowRightCircle className="w-4 h-4 mr-2" />Carry Arrears Now</>
                  )}
                </Button>
              </div>
            )}
            {!currentTermFull && (
              <p className="text-xs text-red-500 mt-2">No active term detected. Set a current term in Settings first.</p>
            )}
          </CardContent>
        </CardHeader>
      </Card>

      <Card className="mt-4 border-amber-200 bg-amber-50/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-amber-800">
            <Trash2 className="w-4 h-4" />
            Clear all payments &amp; receipts
          </CardTitle>
          <CardContent className="text-sm text-amber-800/90">
            <p className="mb-3">
              Permanently delete all payment and receipt records for <strong>this school only</strong>. Receipt numbers will reset and start from 1 again. This cannot be undone.
            </p>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              disabled={clearing}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear all payments &amp; receipts
            </Button>
          </CardContent>
        </CardHeader>
      </Card>

      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => !clearing && setShowClearConfirm(false)}
        onConfirm={handleClearAllPayments}
        title="Clear all payments and receipts?"
        description="This will permanently delete all payments and receipts for this school. Receipt numbers will start from 1 again. This action cannot be undone."
        confirmText={clearing ? 'Clearing…' : 'Yes, clear all'}
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
};

export default FeesModule;
