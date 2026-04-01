
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AddTeacherForm from './AddTeacherForm';
import ViewAllTeachers from './ViewAllTeachers';
import AssignClassToTeacher from './AssignClassToTeacher';
import { GraduationCap, UserPlus, Eye, Users } from 'lucide-react';

const TeachersModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Teachers Management</h1>
            <p className="text-muted-foreground">Manage teaching staff information and assignments</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger value="add-teacher" className="flex items-center space-x-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Teacher</span>
          </TabsTrigger>
          <TabsTrigger value="assign-class" className="flex items-center space-x-2">
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
