import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import RecordPayment from './RecordPayment';
import ViewPayments from './ViewPayments';
import SetFeeStructure from './SetFeeStructure';
import StudentBalances from './StudentBalances';
import ReceiptHistory from './ReceiptHistory';
import OutstandingFees from './OutstandingFees';
import FeeStructureIncompleteModal from './FeeStructureIncompleteModal';
import { apiService } from '../../services/api';
import { useData } from '../../contexts/DataContext';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { useFeeStructureCheck } from '../../hooks/useFeeStructureCheck';
import { useFinanceRealtime } from '../../hooks/useFinanceRealtime';
import { toast } from '@/hooks/use-toast';
import {
  CreditCard,
  DollarSign,
  Eye,
  Users,
  Receipt,
  AlertCircle,
  RefreshCw,
  Loader2,
  Check,
  TriangleAlert,
} from 'lucide-react';

interface AcademicTermOption {
  termLabel: string;
  isCurrent: boolean;
}

type FeesModuleProps = {
  onNavigate?: (moduleId: string) => void;
};

const FEE_OPS_DISABLED_TOOLTIP = 'Set an active term to enable this action.';
const FEE_STRUCTURE_DISABLED_TOOLTIP = 'Configure fee structures for all classes to enable this action.';

const FeesModule: React.FC<FeesModuleProps> = ({ onNavigate }) => {
  const { refresh } = useData();
  const {
    currentTerm,
    currentYear,
    hasActiveTerm,
    activeAcademicTermId,
    activeLedgerTermId,
    isLoading: termLoading,
  } = useActiveTerm();

  useEffect(() => {
    if (activeLedgerTermId != null) {
      void refresh(['fees', 'payments', 'students', 'classes']);
    }
  }, [activeLedgerTermId, refresh]);

  useFinanceRealtime({
    onInvalidate: () => {
      void refresh(['fees', 'payments', 'students']);
    },
  });
  const [activeTab, setActiveTab] = useState('record-payment');
  const [refreshing, setRefreshing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [structureModalOpen, setStructureModalOpen] = useState(false);
  const [structureModalDismissed, setStructureModalDismissed] = useState(false);

  const { data: structureCheck, isLoading: structureLoading } = useFeeStructureCheck(
    activeLedgerTermId,
    hasActiveTerm
  );

  const structureIncomplete =
    hasActiveTerm && structureCheck != null && structureCheck.complete === false;
  const paymentOpsDisabled = !hasActiveTerm || structureIncomplete;
  const paymentDisabledReason = !hasActiveTerm
    ? FEE_OPS_DISABLED_TOOLTIP
    : structureIncomplete
      ? FEE_STRUCTURE_DISABLED_TOOLTIP
      : null;

  const [termOptions, setTermOptions] = useState<AcademicTermOption[]>([]);
  const [selectedPrevTerm, setSelectedPrevTerm] = useState('');
  const [carryingArrears, setCarryingArrears] = useState(false);

  const currentTermFull =
    currentTerm && currentYear && !currentTerm.includes(currentYear)
      ? `${currentTerm} ${currentYear}`.trim()
      : currentTerm || '';

  useEffect(() => {
    apiService
      .get('/settings/academic-terms')
      .then((data: AcademicTermOption[] | Array<{ term_name: string; year: string; is_active: boolean }>) => {
        if (!Array.isArray(data)) return;
        const options: AcademicTermOption[] = data.map((t: any) => {
          const label = `${t.term_name} ${t.year}`.trim();
          return { termLabel: label, isCurrent: t.is_active };
        });
        setTermOptions(options);
        const others = options.filter((o) => !o.isCurrent);
        if (others.length > 0) setSelectedPrevTerm(others[0].termLabel);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setStructureModalDismissed(false);
  }, [activeAcademicTermId, activeLedgerTermId, currentTerm]);

  useEffect(() => {
    if (
      hasActiveTerm &&
      !structureLoading &&
      structureCheck &&
      !structureCheck.complete &&
      !structureModalDismissed
    ) {
      setStructureModalOpen(true);
    }
  }, [hasActiveTerm, structureLoading, structureCheck, structureModalDismissed]);

  const handleTabChange = useCallback(
    (tab: string) => {
      if (tab === 'record-payment' && paymentOpsDisabled) {
        if (structureIncomplete) {
          setStructureModalOpen(true);
        }
        return;
      }
      setActiveTab(tab);
    },
    [paymentOpsDisabled, structureIncomplete]
  );

  const previousTermOptions = termOptions.filter(
    (t) => t.termLabel !== currentTermFull && !t.isCurrent
  );

  const handleCarryArrears = async () => {
    if (!hasActiveTerm) {
      toast({
        title: 'No active term',
        description: 'Set an active term in Settings first.',
        variant: 'destructive',
      });
      return;
    }
    if (!selectedPrevTerm) {
      toast({
        title: 'Select previous term',
        description: 'Choose the term whose outstanding balance should become arrears.',
        variant: 'destructive',
      });
      return;
    }
    setCarryingArrears(true);
    try {
      const result: any = await apiService.post('/finance/carry-arrears', { previousTerm: selectedPrevTerm });
      const total = result.arrearsRowsInserted ?? 0;
      toast({
        title: total > 0 ? 'Arrears carried successfully' : 'No arrears to carry',
        description:
          total > 0
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
    <TooltipProvider>
      <div className="p-4 sm:p-6 lg:p-8">
        {!termLoading && !hasActiveTerm && (
          <div className="mb-4 flex w-full flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm font-medium text-amber-900">
                No active term is set. All fee operations are disabled until an active term is configured.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
              onClick={() => onNavigate?.('settings')}
            >
              Go to Term Settings
            </Button>
          </div>
        )}

        <div className="mb-6 flex items-center justify-between rounded-[1.35rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:rounded-none dark:border-transparent dark:bg-transparent dark:p-0 dark:shadow-none dark:backdrop-blur-none">
          <div className="flex items-center space-x-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#146C43] via-emerald-600 to-[#22C55E] shadow-lg shadow-emerald-500/20 dark:h-10 dark:w-10 dark:rounded-lg dark:from-green-500 dark:to-emerald-600 dark:shadow-none">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#0F172A] dark:text-gray-100">
                Fees Management
              </h1>
              <p className="text-sm font-medium text-[#64748B] dark:text-gray-400">
                Manage school fees, payments, and financial records
              </p>
            </div>
          </div>
          <div className="ml-4 flex items-center">
            <button
              type="button"
              aria-label="Refresh fees data"
              onClick={async () => {
                try {
                  setRefreshing(true);
                  await apiService.post('/fees/sync-ledger').catch(() => undefined);
                  await refresh(['fees', 'payments', 'students', 'classes']);
                  setRefreshing(false);
                  setSuccess(true);
                  setTimeout(() => setSuccess(false), 1500);
                } catch (err: any) {
                  setRefreshing(false);
                  toast({
                    title: 'Refresh failed',
                    description: err?.message || 'Could not refresh fees data',
                    variant: 'destructive',
                  });
                }
              }}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
                success
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                  : 'border-white/70 bg-white/60 text-slate-700 hover:bg-white'
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

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 overflow-x-auto p-1.5 sm:grid-cols-3 lg:grid-cols-6 lg:w-full dark:h-10 dark:p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex w-full">
                  <TabsTrigger
                    value="record-payment"
                    className="flex w-full items-center space-x-2"
                    disabled={paymentOpsDisabled}
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>Record Payment</span>
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              {paymentDisabledReason && (
                <TooltipContent>{paymentDisabledReason}</TooltipContent>
              )}
            </Tooltip>
            <TabsTrigger value="view-payments" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>View Payments</span>
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center space-x-2">
              <Receipt className="h-4 w-4" />
              <span>Receipts</span>
            </TabsTrigger>
            <TabsTrigger value="balances" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Student Balances</span>
            </TabsTrigger>
            <TabsTrigger value="outstanding" className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4" />
              <span>Outstanding Fees</span>
            </TabsTrigger>
            <TabsTrigger value="fee-structure" className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4" />
              <span>Fee Structure / Bill</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="record-payment">
            <RecordPayment
              paymentOpsDisabled={paymentOpsDisabled}
              paymentDisabledReason={paymentDisabledReason}
              onBlockedSubmit={() => {
                if (structureIncomplete) setStructureModalOpen(true);
              }}
            />
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

        <FeeStructureIncompleteModal
          open={structureModalOpen}
          missingClasses={structureCheck?.missing_classes ?? []}
          onClose={() => {
            setStructureModalOpen(false);
            setStructureModalDismissed(true);
          }}
          onGoToSetup={() => {
            setStructureModalOpen(false);
            setStructureModalDismissed(true);
            setActiveTab('fee-structure');
          }}
        />
      </div>
    </TooltipProvider>
  );
};

export default FeesModule;
