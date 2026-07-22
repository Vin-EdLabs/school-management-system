import React, { useState } from 'react';
import { CreditCard, Settings2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import OnlinePaymentsTable from './OnlinePaymentsTable';
import PaystackSettingsPanel from './PaystackSettingsPanel';

export default function PaystackModule() {
  const { hasAccess } = useAuth();
  const canConfigure = hasAccess('settings-full');
  const defaultTab = canConfigure ? 'transactions' : 'transactions';

  const [tab, setTab] = useState(defaultTab);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Paystack</h1>
        <p className="mt-1 text-sm text-slate-500">Online fee payments and Paystack configuration</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="transactions" className="gap-2">
            <CreditCard className="h-4 w-4" /> Online payments
          </TabsTrigger>
          {canConfigure ? (
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" /> Configuration
            </TabsTrigger>
          ) : null}
        </TabsList>
        <TabsContent value="transactions" className="mt-5">
          <OnlinePaymentsTable />
        </TabsContent>
        {canConfigure ? (
          <TabsContent value="settings" className="mt-5">
            <PaystackSettingsPanel />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
