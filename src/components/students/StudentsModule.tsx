
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
  const [promoteStudentIdSeed, setPromoteStudentIdSeed] = useState<string | null>(null);

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage student information, enrollment, and promotions.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex w-auto bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl h-12 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger value="view-all" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <Eye className="w-4 h-4" />
            View All
          </TabsTrigger>
          <TabsTrigger value="add-student" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <UserPlus className="w-4 h-4" />
            Add Student
          </TabsTrigger>
          <TabsTrigger value="promote" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <TrendingUp className="w-4 h-4" />
            Promote
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllStudents
            onRequestPromoteStudent={(id) => {
              setPromoteStudentIdSeed(id);
              setActiveTab('promote');
            }}
          />
        </TabsContent>

        <TabsContent value="add-student">
          <AddStudentForm onSuccess={() => setActiveTab('view-all')} />
        </TabsContent>

        <TabsContent value="promote">
          <PromoteStudents
            initialStudentId={promoteStudentIdSeed}
            onConsumeInitialStudentId={() => setPromoteStudentIdSeed(null)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsModule;
