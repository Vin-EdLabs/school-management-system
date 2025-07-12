
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

const FeesModule = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Fees Management</h1>
            <p className="text-gray-600">Manage school fees, payments, and financial records</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Set Fee Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Configure fees for different classes and terms</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Record Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Record student fee payments</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>View Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View and manage all payments</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Generate Receipt</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Generate printable payment receipts</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Student Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View outstanding balances for all students</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FeesModule;
