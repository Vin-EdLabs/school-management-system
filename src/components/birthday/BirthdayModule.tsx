import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cake, Gift, Sparkles, Users, GraduationCap, Calendar } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';

interface BirthdayPerson {
  id: number;
  fullName: string;
  type: 'student' | 'teacher';
  dateOfBirth: string;
  age: number;
  classId?: number | null;
  className?: string | null;
  photoUrl?: string | null;
}

interface BirthdayGroup {
  date: string;
  dayLabel: string;
  people: BirthdayPerson[];
}

interface MonthSection {
  label: string;
  year: number;
  month: number;
  groups: BirthdayGroup[];
}

function formatMonthDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

function BirthdayGroupList({ groups }: { groups: BirthdayGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-gray-500 text-center py-4">No birthdays this month.</p>;
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <p className="text-sm font-semibold text-gray-700">{formatMonthDay(group.date)}</p>
            <Badge variant="outline" className="text-xs">
              {group.people.length}
            </Badge>
          </div>
          <div className="ml-4 space-y-1.5">
            {group.people.map((person) => (
              <div
                key={`u-${person.type}-${person.id}`}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/50 dark:to-blue-800/30 flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                  {person.fullName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {person.fullName}
                    <span className="font-normal text-gray-400 ml-1 text-xs">turns {person.age}</span>
                  </p>
                  <p className="text-xs text-gray-400">
                    {person.type === 'student' ? 'Student' : 'Teacher'}
                    {person.className && ` · ${person.className}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const BirthdayModule = () => {
  const { schoolId } = useSchool();
  const [todayBirthdays, setTodayBirthdays] = useState<BirthdayPerson[]>([]);
  const [monthSection, setMonthSection] = useState<MonthSection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBirthdays = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        apiService.setTenantContext(schoolId);
        const [todayRes, sectionsRes] = await Promise.all([
          apiService.get<BirthdayPerson[]>('/birthdays/today'),
          apiService.get<MonthSection>('/birthdays/upcoming?scope=months'),
        ]);
        setTodayBirthdays(Array.isArray(todayRes) ? todayRes : []);
        setMonthSection(sectionsRes);
      } catch {
        setTodayBirthdays([]);
        setMonthSection(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBirthdays();
  }, [schoolId]);

  const todayStudents = todayBirthdays.filter((p) => p.type === 'student');
  const todayTeachers = todayBirthdays.filter((p) => p.type === 'teacher');
  const monthCount = monthSection?.groups.reduce((sum, g) => sum + g.people.length, 0) ?? 0;

  return (
    <div className="px-4 py-5 sm:p-6 space-y-5 sm:space-y-6 max-w-5xl mx-auto w-full">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
          <Cake className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100">Birthdays</h1>
          <p className="text-sm text-gray-500 mt-0.5">Celebrate students and teachers on their special day</p>
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse text-slate-500">Loading birthdays...</div>
      ) : (
        <>
          {todayBirthdays.length > 0 && (
            <Card className="border-amber-300/60 dark:border-amber-700/40 overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="w-5 h-5 text-amber-500" />
                  Today's Birthdays
                  <Badge className="ml-auto bg-amber-500 text-white">{todayBirthdays.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {todayStudents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                      <Users className="w-4 h-4" /> Students ({todayStudents.length})
                    </h3>
                    <div className="space-y-2">
                      {todayStudents.map((person) => (
                        <div
                          key={`s-${person.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/10 border border-amber-200/40"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {person.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {person.fullName}
                              <span className="font-normal text-gray-500 ml-1">turns {person.age}!</span>
                            </p>
                            <p className="text-xs text-gray-500">{person.className && `${person.className}`}</p>
                          </div>
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {todayTeachers.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                      <GraduationCap className="w-4 h-4" /> Teachers ({todayTeachers.length})
                    </h3>
                    <div className="space-y-2">
                      {todayTeachers.map((person) => (
                        <div
                          key={`t-${person.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-purple-50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/10 border border-purple-200/40"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {person.fullName.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-gray-900">
                              {person.fullName}
                              <span className="font-normal text-gray-500 ml-1">turns {person.age}!</span>
                            </p>
                            {person.className && <p className="text-xs text-gray-500">{person.className}</p>}
                          </div>
                          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {todayBirthdays.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Cake className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-gray-700 mb-1">No birthdays today</h3>
                <p className="text-sm text-gray-500">See remaining birthdays for this month below.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="w-5 h-5 text-blue-500" />
                {monthSection?.label ?? 'This Month'}
                <Badge variant="secondary" className="ml-auto">
                  {monthCount} this month
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BirthdayGroupList groups={monthSection?.groups ?? []} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default BirthdayModule;
