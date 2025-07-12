
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown } from 'lucide-react';

const ExpensesModule = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Expenses Management</h1>
            <p className="text-gray-600">Track and manage school expenses</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Expense</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Record new school expenses</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>View All Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View and manage all expense records</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExpensesModule;
