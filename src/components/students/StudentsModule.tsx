
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-4">
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger value="add-student" className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Student</span>
          </TabsTrigger>
          <TabsTrigger value="promote" className="flex items-center space-x-2">
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
