
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddExpenseForm from './AddExpenseForm';
import ViewAllExpenses from './ViewAllExpenses';
import { TrendingDown, Plus, Eye } from 'lucide-react';

const ExpensesModule = () => {
  const [activeTab, setActiveTab] = useState('add-expense');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-rose-600 rounded-lg flex items-center justify-center">
            <TrendingDown className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Expenses Management</h1>
            <p className="text-muted-foreground">Track and manage school expenses</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:grid-cols-2">
          <TabsTrigger value="add-expense" className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </TabsTrigger>
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="add-expense">
          <AddExpenseForm />
        </TabsContent>

        <TabsContent value="view-all">
          <ViewAllExpenses />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExpensesModule;
