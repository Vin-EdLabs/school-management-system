
import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import CreateClassForm from './CreateClassForm';
import ViewAllClasses from './ViewAllClasses';
import AssignStudentsToClass from './AssignStudentsToClass';
import { School, Plus, Eye, Users } from 'lucide-react';

const ClassesModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <School className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Classes Management</h1>
            <p className="text-muted-foreground">Manage class information and student assignments</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:grid-cols-3">
          <TabsTrigger value="view-all" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger value="create-class" className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>Create Class</span>
          </TabsTrigger>
          <TabsTrigger value="assign-students" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Assign Students</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllClasses />
        </TabsContent>

        <TabsContent value="create-class">
          <CreateClassForm onSuccess={() => setActiveTab('view-all')} />
        </TabsContent>

        <TabsContent value="assign-students">
          <AssignStudentsToClass />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ClassesModule;
