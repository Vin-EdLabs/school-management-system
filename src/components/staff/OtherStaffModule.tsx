import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserCog, UserPlus, Eye, Users } from 'lucide-react';
import ViewAllOtherStaff from './ViewAllOtherStaff';
import AddOtherStaffForm from './AddOtherStaffForm';
import AllStaffView from './AllStaffView';

const OtherStaffModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAdded = () => {
    setRefreshKey((k) => k + 1);
    setActiveTab('view-all');
  };

  return (
    <div className="min-h-full p-4 pb-8 sm:p-6 sm:pb-10">
      <div className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-xl flex items-center justify-center shadow-lg">
            <UserCog className="w-7 h-7 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Other Staff</h1>
            <p className="text-muted-foreground">Non-teaching staff — profiles, payroll, and system access</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-3 overflow-x-auto rounded-xl bg-muted/70 p-1 lg:w-auto lg:grid-cols-3">
          <TabsTrigger value="view-all" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <Eye className="w-4 h-4" />
            <span>View All</span>
          </TabsTrigger>
          <TabsTrigger value="all-staff" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <Users className="w-4 h-4" />
            <span>All Staff</span>
          </TabsTrigger>
          <TabsTrigger value="add-staff" className="flex min-h-10 items-center justify-center gap-2 whitespace-nowrap px-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Staff</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllOtherStaff refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="all-staff">
          <AllStaffView />
        </TabsContent>

        <TabsContent value="add-staff">
          <AddOtherStaffForm onSuccess={handleAdded} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OtherStaffModule;
