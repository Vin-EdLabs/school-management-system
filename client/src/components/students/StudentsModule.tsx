
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Students Management</h1>
            <p className="text-gray-600">Manage student information and records</p>
          </div>
        </div>
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
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger
            value="add-student"
            disabled={!hasActiveTerm}
            className="flex items-center space-x-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </TabsTrigger>
          <TabsTrigger
            value="promote"
            disabled={!hasActiveTerm}
            className="flex items-center space-x-2"
          >
            <TrendingUp className="w-4 h-4" />
            <span>Promote</span>
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
