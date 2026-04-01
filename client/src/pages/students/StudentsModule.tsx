
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddStudentForm from './AddStudentForm';
import ViewAllStudents from './ViewAllStudents';
import PromoteStudents from './PromoteStudents';
import { Users, UserPlus, Eye, TrendingUp, AlertCircle } from 'lucide-react';
import { useActiveTerm } from '@/hooks/useSettings';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Link } from 'react-router-dom';

const StudentsModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');
  const { data: activeTerm } = useActiveTerm();
  const hasActiveTerm = !!activeTerm;

  return (
<<<<<<< HEAD:src/components/students/StudentsModule.tsx
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-slate-800">Students</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage student information and records</p>
=======
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Students Management</h1>
            <p className="text-muted-foreground">Manage student information and records</p>
          </div>
        </div>
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/StudentsModule.tsx
      </div>

      {!hasActiveTerm && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No Active Academic Term</AlertTitle>
          <AlertDescription>
            You must have an active academic term before adding or promoting students.
            Please go to <Link to="/dashboard/settings" className="font-bold underline">Settings</Link> to set an active term.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-100 p-1 rounded-lg h-10">
          <TabsTrigger value="view-all" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
            <Eye className="w-4 h-4" />
            View All
          </TabsTrigger>
<<<<<<< HEAD:src/components/students/StudentsModule.tsx
          <TabsTrigger value="add-student" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
=======
          <TabsTrigger
            value="add-student"
            disabled={!hasActiveTerm}
            className="flex items-center space-x-2"
          >
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/StudentsModule.tsx
            <UserPlus className="w-4 h-4" />
            Add Student
          </TabsTrigger>
<<<<<<< HEAD:src/components/students/StudentsModule.tsx
          <TabsTrigger value="promote" className="flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-md px-4">
=======
          <TabsTrigger
            value="promote"
            disabled={!hasActiveTerm}
            className="flex items-center space-x-2"
          >
>>>>>>> 2e5ad4213fffb0947f010ccd8b64dce950e9b5c9:client/src/pages/students/StudentsModule.tsx
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
