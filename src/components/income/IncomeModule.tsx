
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';

const IncomeModule = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Other Income</h1>
            <p className="text-gray-600">Manage additional income sources</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Record additional income sources</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>View All Income</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">View and manage all income records</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IncomeModule;
