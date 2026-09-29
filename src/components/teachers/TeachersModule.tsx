
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddTeacherForm from './AddTeacherForm';
import ViewAllTeachers from './ViewAllTeachers';
import AssignClassToTeacher from './AssignClassToTeacher';
import { GraduationCap, UserPlus, Eye, Users } from 'lucide-react';

const TeachersModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');

  return (
    <div className="min-h-full p-3.5 pb-6 sm:p-4 md:p-5 sm:pb-8">
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Teachers Management</h1>
            <p className="text-muted-foreground">Manage teaching staff information and assignments</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-3 overflow-x-auto rounded-xl bg-muted/70 p-1 lg:w-auto lg:grid-cols-3">
          <TabsTrigger value="view-all" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger value="add-teacher" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Teacher</span>
          </TabsTrigger>
          <TabsTrigger value="assign-class" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <Users className="w-4 h-4" />
            <span>Assign Class</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllTeachers />
        </TabsContent>

        <TabsContent value="add-teacher">
          <AddTeacherForm onSuccess={() => setActiveTab('view-all')} />
        </TabsContent>

        <TabsContent value="assign-class">
          <AssignClassToTeacher />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TeachersModule;
