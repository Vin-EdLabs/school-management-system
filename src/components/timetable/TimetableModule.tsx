import React, { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { isHeadmasterRole } from '@/utils/headmasterPortal';
import ClassTimetableBuilder from './ClassTimetableBuilder';
import ExamTimetableView from './ExamTimetableView';
import TeacherScheduleView from './TeacherScheduleView';
import TimetableOverview from './TimetableOverview';
import { timetablePageSubtitleClass, timetablePageTitleClass, timetableTabsListClass } from './timetableUtils';

export default function TimetableModule() {
  const { user, actsAsPrimaryAdmin } = useAuth();

  const canEdit = useMemo(() => {
    if (!user) return false;
    if (actsAsPrimaryAdmin) return true;
    const role = user.role;
    return role === 'administrator' || isHeadmasterRole(role);
  }, [user, actsAsPrimaryAdmin]);

  const isTeacherLike = user?.role === 'teacher' || user?.role === 'staff';
  const showAdminTabs = canEdit || isHeadmasterRole(user?.role);
  const showOverview = showAdminTabs;
  const showMySchedule = isTeacherLike || isHeadmasterRole(user?.role);
  const defaultTab = showMySchedule && !showAdminTabs ? 'my-schedule' : showMySchedule ? 'my-schedule' : 'class';

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20 dark:shadow-emerald-900/40">
          <CalendarDays className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className={timetablePageTitleClass}>Timetable</h1>
          <p className={timetablePageSubtitleClass}>
            {showAdminTabs
              ? 'Build class schedules, exam timetables, and teacher schedules'
              : 'Your personal teaching schedule and exam duties'}
          </p>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className={timetableTabsListClass}>
          {showMySchedule ? (
            <TabsTrigger value="my-schedule" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
              My schedule
            </TabsTrigger>
          ) : null}
          {showAdminTabs ? (
            <>
              <TabsTrigger value="class" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
                Class timetable
              </TabsTrigger>
              <TabsTrigger value="exam" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
                Exam timetable
              </TabsTrigger>
            </>
          ) : null}
          {showOverview ? (
            <TabsTrigger value="overview" className="dark:data-[state=active]:bg-slate-900 dark:data-[state=active]:text-emerald-400">
              School overview
            </TabsTrigger>
          ) : null}
        </TabsList>

        {showMySchedule ? (
          <TabsContent value="my-schedule">
            <TeacherScheduleView />
          </TabsContent>
        ) : null}

        {showAdminTabs ? (
          <>
            <TabsContent value="class">
              <ClassTimetableBuilder canEdit={canEdit} />
            </TabsContent>
            <TabsContent value="exam">
              <ExamTimetableView canEdit={canEdit} />
            </TabsContent>
          </>
        ) : null}

        {showOverview ? (
          <TabsContent value="overview">
            <TimetableOverview readOnly={!canEdit} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
