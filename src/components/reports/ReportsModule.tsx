
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

const ReportsModule = () => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Reports & Analytics</h1>
            <p className="text-gray-600">Generate comprehensive school reports</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Term Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Comprehensive term performance report</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Student Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Outstanding fees and payment reports</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Financial performance analysis</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Export Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Export data to PDF or Excel</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsModule;
