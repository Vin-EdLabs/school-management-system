import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, Settings2, CreditCard, History } from 'lucide-react';
import { useActiveTerm } from '../../hooks/useActiveTerm';
import { useFinanceRealtime } from '../../hooks/useFinanceRealtime';
import { useData } from '../../contexts/DataContext';
import DailyFeeStructureTab from './DailyFeeStructureTab';
import DailyFeeRecordPaymentTab from './DailyFeeRecordPaymentTab';
import DailyFeePaymentHistoryTab from './DailyFeePaymentHistoryTab';
import { Button } from '@/components/ui/button';
import { TriangleAlert } from 'lucide-react';

const DailyFeesModule: React.FC<{ onNavigate?: (moduleId: string) => void }> = ({ onNavigate }) => {
  const { refresh } = useData();
  const { hasActiveTerm, isLoading: termLoading } = useActiveTerm();
  const [activeTab, setActiveTab] = useState('structure');

  useFinanceRealtime({
    onInvalidate: () => void refresh(['classes', 'students', 'payments']),
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {!termLoading && !hasActiveTerm && (
        <div className="mb-4 flex w-full flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm font-medium text-amber-900">
              No active term is set. Configure an active term before setting up daily fees.
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

      <div className="mb-6 flex items-center space-x-3 rounded-[1.35rem] border border-white/70 bg-white/70 p-4 shadow-[0_18px_45px_rgba(15,23,42,0.05)] backdrop-blur-xl dark:rounded-none dark:border-transparent dark:bg-transparent dark:p-0 dark:shadow-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#146C43] via-emerald-600 to-[#22C55E] shadow-lg shadow-emerald-500/20">
          <CalendarDays className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Daily Fee Collections</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Manage daily, weekly, monthly and termly fee collections
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-2xl bg-slate-100/80 p-1.5 dark:bg-slate-800/50">
          <TabsTrigger value="structure" className="gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Settings2 className="h-4 w-4" />
            Fee Structure
          </TabsTrigger>
          <TabsTrigger value="record" className="gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" />
            Record Payment
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <History className="h-4 w-4" />
            Payment History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="structure">
          <DailyFeeStructureTab disabled={!hasActiveTerm} />
        </TabsContent>
        <TabsContent value="record">
          <DailyFeeRecordPaymentTab disabled={!hasActiveTerm} />
        </TabsContent>
        <TabsContent value="history">
          <DailyFeePaymentHistoryTab disabled={!hasActiveTerm} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DailyFeesModule;
