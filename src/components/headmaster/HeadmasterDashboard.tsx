import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users,
  GraduationCap,
  School,
  Calendar,
  Megaphone,
  ClipboardCheck,
  Award,
  Crown,
  ArrowRight,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSchool } from '@/contexts/SchoolContext';
import { useData } from '@/contexts/DataContext';
import { apiService } from '@/services/api';
import { useEnsureData } from '@/hooks/useEnsureData';
import { formatDisplayDate } from '@/utils/dateFormat';

type HeadmasterDashboardProps = {
  onNavigate: (module: string) => void;
};

const HeadmasterDashboard: React.FC<HeadmasterDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { school } = useSchool();
  const { students, classes } = useData();
  useEnsureData(['students', 'classes']);
  const [upcomingEvents, setUpcomingEvents] = useState(0);
  const [totalStaff, setTotalStaff] = useState(0);

  useEffect(() => {
    void apiService
      .get<unknown[]>('/events')
      .then((rows) => setUpcomingEvents(Array.isArray(rows) ? rows.length : 0))
      .catch(() => setUpcomingEvents(0));
    void apiService
      .get<{ count: number }>('/reports/admin-overview')
      .then((data) => {
        const teachers = data?.teachers?.total ?? 0;
        const other = data?.otherStaff?.total ?? 0;
        setTotalStaff(teachers + other);
      })
      .catch(() => setTotalStaff(0));
  }, []);

  const activeStudents = useMemo(
    () => students.filter((s) => (s.enrollmentStatus || 'active').toLowerCase() === 'active').length,
    [students]
  );

  const quickLinks = [
    { id: 'push-notifications', label: 'Announcements', icon: Megaphone },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'headmaster-grades', label: 'Grades', icon: Award },
    { id: 'headmaster-all-attendance', label: 'Attendance', icon: ClipboardCheck },
    { id: 'records', label: 'Records', icon: Search },
  ];

  return (
    <div className="px-4 py-5 sm:p-6 space-y-6 max-w-7xl mx-auto w-full">
      <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950 p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-amber-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-100 ring-1 ring-amber-400/30">
              <Crown className="h-3.5 w-3.5" />
              Headmaster
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
              Welcome, {user?.fullName || 'Headmaster'}
            </h1>
            <p className="text-sm text-white/75 max-w-xl">
              {school?.name ? `Headmaster, ${school.name}` : 'School leadership overview'} — monitor the
              school, support your teachers, and stay connected with parents.
            </p>
            <p className="text-xs text-white/50">{formatDisplayDate(new Date())}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border-emerald-200/50 dark:border-emerald-900/40">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Students</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{activeStudents}</p>
              </div>
              <Users className="h-8 w-8 text-emerald-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Staff</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{totalStaff}</p>
              </div>
              <GraduationCap className="h-8 w-8 text-blue-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Classes</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{classes.length}</p>
              </div>
              <School className="h-8 w-8 text-violet-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Calendar Events</p>
                <p className="text-2xl sm:text-3xl font-bold tabular-nums">{upcomingEvents}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-500 shrink-0" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg">Quick links</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {quickLinks.map((link) => (
            <Button
              key={link.id}
              type="button"
              variant="outline"
              className="h-auto min-h-[52px] justify-between rounded-xl px-4 py-3"
              onClick={() => onNavigate(link.id)}
            >
              <span className="flex items-center gap-2 font-medium">
                <link.icon className="h-4 w-4 text-amber-600" />
                {link.label}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Button>
          ))}
        </CardContent>
      </Card>

      {user?.teacherId && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-foreground">My teaching</p>
              <p className="text-sm text-muted-foreground">
                You are also assigned to teach — use My Classes for your own assessments and attendance.
              </p>
            </div>
            <Button type="button" variant="primaryAction" onClick={() => onNavigate('teacher-classes')}>
              Open My Classes
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Badge variant="outline" className="mr-2 text-[10px]">Read-only oversight</Badge>
        School-wide student, staff, and fee views are read-only. Use Announcements and Calendar to lead the school community.
      </div>
    </div>
  );
};

export default HeadmasterDashboard;
