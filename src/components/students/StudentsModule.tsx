
import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import AddStudentForm from './AddStudentForm';
import ViewAllStudents from './ViewAllStudents';
import PromoteStudents from './PromoteStudents';
import { useData } from '../../contexts/DataContext';
import { normalizeEnrollmentStatus } from './studentRegistryUtils';
import AlumniStudents from './AlumniStudents';
import { Eye, UserPlus, TrendingUp, UserX, GraduationCap } from 'lucide-react';

const StudentsModule = () => {
  const [activeTab, setActiveTab] = useState('view-all');
  const [promoteStudentIdSeed, setPromoteStudentIdSeed] = useState<string | null>(null);
  const { students } = useData();

  const inactiveCount = useMemo(
    () => students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'inactive').length,
    [students]
  );

  const alumniCount = useMemo(
    () => students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'graduated').length,
    [students]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage student information, enrollment, and promotions.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex w-auto flex-wrap bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl h-auto min-h-12 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger value="view-all" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <Eye className="w-4 h-4" />
            View All
          </TabsTrigger>
          <TabsTrigger value="inactive" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <UserX className="w-4 h-4" />
            Inactive Students
            {inactiveCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] rounded-full px-1.5 text-[10px] tabular-nums">
                {inactiveCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="add-student" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <UserPlus className="w-4 h-4" />
            Add Student
          </TabsTrigger>
          <TabsTrigger value="promote" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <TrendingUp className="w-4 h-4" />
            Promote
          </TabsTrigger>
          <TabsTrigger value="alumni" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <GraduationCap className="w-4 h-4" />
            Alumni
            {alumniCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] rounded-full px-1.5 text-[10px] tabular-nums">
                {alumniCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="view-all">
          <ViewAllStudents
            variant="active"
            onRequestPromoteStudent={(id) => {
              setPromoteStudentIdSeed(id);
              setActiveTab('promote');
            }}
          />
        </TabsContent>

        <TabsContent value="inactive">
          <ViewAllStudents variant="inactive" />
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

        <TabsContent value="alumni">
          <AlumniStudents />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsModule;
