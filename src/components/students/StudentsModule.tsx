
import React, { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import AddStudentForm from './AddStudentForm';
import ViewAllStudents from './ViewAllStudents';
import PromoteStudents from './PromoteStudents';
import { useData } from '../../contexts/DataContext';
import { normalizeEnrollmentStatus, isInactiveEnrollmentStatus } from './studentRegistryUtils';
import AlumniStudents from './AlumniStudents';
import PendingAdmissions from './PendingAdmissions';
import { Eye, UserPlus, TrendingUp, UserX, GraduationCap, RotateCcw, Clock } from 'lucide-react';


const StudentsModule = ({ readOnly = false }: { readOnly?: boolean }) => {
  const [activeTab, setActiveTab] = useState('view-all');
  const [promoteStudentIdSeed, setPromoteStudentIdSeed] = useState<string | null>(null);
  const { students, refresh } = useData();
  const [isRefreshing, setIsRefreshing] = useState(false);


  const pendingCount = useMemo(
    () => students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'pending').length,
    [students]
  );

  const activeCount = useMemo(
    () => students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'active').length,
    [students]
  );

  const inactiveCount = useMemo(
    () => students.filter((s) => isInactiveEnrollmentStatus(s.enrollmentStatus)).length,
    [students]
  );

  const alumniCount = useMemo(
    () => students.filter((s) => normalizeEnrollmentStatus(s.enrollmentStatus) === 'graduated').length,
    [students]
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 animate-in fade-in duration-500">
      <div className="mb-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {readOnly ? 'All Students' : 'Students'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {readOnly
                ? 'School-wide student records — read-only view.'
                : 'Manage student information, enrollment, and promotions.'}{' '}
              <span className="tabular-nums">{activeCount} active</span>
              {pendingCount > 0 && <span> · {pendingCount} pending</span>}
              {alumniCount > 0 && <span> · {alumniCount} alumni</span>}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 rounded-xl"
            onClick={async () => {
              setIsRefreshing(true);
              try {
                await refresh(['students', 'classes']);
              } finally {
                setIsRefreshing(false);
              }
            }}
            disabled={isRefreshing}
            aria-label="Refresh students"
          >
            <RotateCcw
              className={
                isRefreshing
                  ? 'h-4 w-4 animate-[spin_550ms_ease-in-out]'
                  : 'h-4 w-4'
              }
            />
            Refresh
          </Button>
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="inline-flex w-auto flex-wrap bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl h-auto min-h-12 border border-slate-200/50 dark:border-slate-700/50">
          <TabsTrigger value="view-all" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <Eye className="w-4 h-4" />
            View All
          </TabsTrigger>
          <TabsTrigger value="pending" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <Clock className="w-4 h-4" />
            Pending
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-[1.25rem] rounded-full px-1.5 text-[10px] tabular-nums">
                {pendingCount}
              </Badge>
            )}
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
          {!readOnly && (
          <TabsTrigger value="add-student" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <UserPlus className="w-4 h-4" />
            Add Student
          </TabsTrigger>
          )}
          {!readOnly && (
          <TabsTrigger value="promote" className="flex items-center gap-2 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 data-[state=active]:shadow-sm rounded-lg px-6 font-bold text-[11px] uppercase tracking-wider transition-all">
            <TrendingUp className="w-4 h-4" />
            Promote
          </TabsTrigger>
          )}
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
            readOnly={readOnly}
            onRequestPromoteStudent={readOnly ? undefined : (id) => {
              setPromoteStudentIdSeed(id);
              setActiveTab('promote');
            }}
          />
        </TabsContent>

        <TabsContent value="pending">
          <PendingAdmissions />
        </TabsContent>

        <TabsContent value="inactive">
          <ViewAllStudents variant="inactive" readOnly={readOnly} />
        </TabsContent>

        {!readOnly && (
        <TabsContent value="add-student">
          <AddStudentForm
            onSuccess={(mode) => setActiveTab(mode === 'pending' ? 'pending' : 'view-all')}
          />
        </TabsContent>
        )}

        {!readOnly && (
        <TabsContent value="promote">
          <PromoteStudents
            initialStudentId={promoteStudentIdSeed}
            onConsumeInitialStudentId={() => setPromoteStudentIdSeed(null)}
          />
        </TabsContent>
        )}

        <TabsContent value="alumni">
          <AlumniStudents />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StudentsModule;
