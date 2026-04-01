
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddIncomeForm from './AddIncomeForm';
import ViewAllIncome from './ViewAllIncome';
import { TrendingUp, Plus, Eye } from 'lucide-react';

const IncomeModule = () => {
  const [activeTab, setActiveTab] = useState('add-income');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Other Income</h1>
            <p className="text-muted-foreground">Manage additional income sources</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
          <TabsTrigger value="add-income" className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Income</span>
          </TabsTrigger>
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add-income">
          <AddIncomeForm />
        </TabsContent>

        <TabsContent value="view-all">
          <ViewAllIncome />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IncomeModule;
