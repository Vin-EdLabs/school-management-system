import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RecordPayment from './RecordPayment';
import ViewPayments from './ViewPayments';
import SetFeeStructure from './SetFeeStructure';
import StudentBalances from './StudentBalances';
import ReceiptHistory from './ReceiptHistory';
import OutstandingFees from './OutstandingFees';
import { apiService } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../contexts/ActiveTermContext';
import { toast } from '@/hooks/use-toast';
import { CreditCard, DollarSign, Eye, Users, Receipt, AlertCircle, RefreshCw, Loader2, Check } from 'lucide-react';

interface AcademicTermOption {
  termLabel: string;   // e.g. "Term 1 2027"
  isCurrent: boolean;
}

const FeesModule = () => {
  const { refresh } = useData();
  const { currentTerm, currentYear } = useActiveTerm();
  const [activeTab, setActiveTab] = useState('record-payment');
  const [refreshing, setRefreshing] = useState(false);
  const [success, setSuccess] = useState(false);

  // Carry arrears state
  const [termOptions, setTermOptions] = useState<AcademicTermOption[]>([]);
  const [selectedPrevTerm, setSelectedPrevTerm] = useState<string>('');
  const [carryingArrears, setCarryingArrears] = useState(false);

  // Current term full string e.g. "Term 2 2027"
  const currentTermFull = (currentTerm && currentYear && !currentTerm.includes(currentYear))
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

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between rounded-[1.35rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:rounded-none dark:border-transparent dark:bg-transparent dark:p-0 dark:shadow-none dark:backdrop-blur-none">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#146C43] via-emerald-600 to-[#22C55E] rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 dark:w-10 dark:h-10 dark:rounded-lg dark:from-green-500 dark:to-emerald-600 dark:shadow-none">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#0F172A] dark:text-gray-100">Fees Management</h1>
            <p className="text-sm font-medium text-[#64748B] dark:text-gray-400">Manage school fees, payments, and financial records</p>
          </div>
        </div>
        <div className="ml-4 flex items-center">
          <button
            type="button"
            aria-label="Refresh fees data"
            onClick={async () => {
              try {
                setRefreshing(true);
                await refresh(['fees', 'payments', 'students']);
                setRefreshing(false);
                setSuccess(true);
                setTimeout(() => setSuccess(false), 1500);
              } catch (err: any) {
                setRefreshing(false);
                toast({ title: 'Refresh failed', description: err?.message || 'Could not refresh fees data', variant: 'destructive' });
              }
            }}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-md border transition-colors ${
              success ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white/60 border-white/70 text-slate-700 hover:bg-white'
            }`}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : success ? (
              <Check className="h-4 w-4" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 overflow-x-auto p-1.5 sm:grid-cols-3 lg:grid-cols-6 lg:w-full dark:h-10 dark:p-1">
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
    </div>
  );
};

export default FeesModule;
