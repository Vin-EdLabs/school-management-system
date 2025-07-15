
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import RecordPayment from './RecordPayment';
import ViewPayments from './ViewPayments';
import SetFeeStructure from './SetFeeStructure';
import StudentBalances from './StudentBalances';
import ReceiptHistory from './ReceiptHistory';
import OutstandingFees from './OutstandingFees';
import { CreditCard, DollarSign, Eye, Users, Receipt, AlertCircle } from 'lucide-react';

const FeesModule = () => {
  const [activeTab, setActiveTab] = useState('record-payment');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Fees Management</h1>
            <p className="text-gray-600">Manage school fees, payments, and financial records</p>
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
    </div>
  );
};

export default FeesModule;
