
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddStudentForm from './AddStudentForm';
import ViewAllStudents from './ViewAllStudents';
import PromoteStudents from './PromoteStudents';
import { Users, UserPlus, Eye, TrendingUp } from 'lucide-react';

const StudentsModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-800">Students</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage student information and records</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-100 p-1 rounded-lg h-10">
          <TabsTrigger value="view-all" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <Eye className="w-4 h-4" />
            View All
          </TabsTrigger>
          <TabsTrigger value="add-student" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <UserPlus className="w-4 h-4" />
            Add Student
          </TabsTrigger>
          <TabsTrigger value="promote" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <TrendingUp className="w-4 h-4" />
            Promote
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllStudents />
        </TabsContent>

        <TabsContent value="add-student">
          <AddStudentForm onSuccess={() => setActiveTab('view-all')} />
        </TabsContent>

        <TabsContent value="promote">
          <PromoteStudents />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsModule;
