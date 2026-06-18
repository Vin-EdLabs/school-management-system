import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Cake, Gift, ChevronRight, Sparkles } from 'lucide-react';
import { apiService } from '../../services/api';
import { useSchool } from '../../contexts/SchoolContext';
import { toast } from 'sonner';

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

const BirthdayWidget = () => {
  const { schoolId } = useSchool();
  const [todayBirthdays, setTodayBirthdays] = useState<BirthdayPerson[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<BirthdayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const notifiedRef = useRef(false);

  useEffect(() => {
    const fetchBirthdays = async () => {
      if (!schoolId) return;
      setLoading(true);
      try {
        apiService.setTenantContext(schoolId);
        const [todayRes, upcomingRes] = await Promise.all([
          apiService.get<BirthdayPerson[]>('/birthdays/today').catch(() => [] as BirthdayPerson[]),
          apiService.get<BirthdayGroup[]>('/birthdays/upcoming?days=30').catch(() => [] as BirthdayGroup[]),
        ]);
        const today = Array.isArray(todayRes) ? todayRes : [];
        setTodayBirthdays(today);
        setUpcomingBirthdays(Array.isArray(upcomingRes) ? upcomingRes : []);

        if (today.length > 0 && !notifiedRef.current) {
          notifiedRef.current = true;
          const names = today.map((p) => p.fullName).join(', ');
          toast(`🎂 ${today.length} birthday${today.length > 1 ? 's' : ''} today!`, {
            description: names,
            duration: 6000,
          });
        }
      } catch {
        setTodayBirthdays([]);
        setUpcomingBirthdays([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBirthdays();
  }, [schoolId]);

  const totalToday = todayBirthdays.length;
  const totalUpcoming = upcomingBirthdays.reduce((sum, g) => sum + g.people.length, 0);
  const hasBirthdays = totalToday > 0 || totalUpcoming > 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse text-slate-500 text-sm">Loading birthdays...</div>
        </CardContent>
      </Card>
    );
  }

  if (!hasBirthdays) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Cake className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No upcoming birthdays</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-amber-200/60 dark:border-amber-800/40">
      <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cake className="w-5 h-5 text-amber-500" />
          Birthdays
          {totalToday > 0 && (
            <Badge className="ml-auto bg-amber-500 hover:bg-amber-600 text-white">
              {totalToday} today
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {todayBirthdays.map((person) => (
          <div
            key={`today-${person.type}-${person.id}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200/50"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {person.fullName}
                <span className="font-normal text-gray-500 ml-1">
                  turns {person.age}!
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {person.type === 'student' ? 'Student' : 'Teacher'}
                {person.className && ` · ${person.className}`}
              </p>
            </div>
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          </div>
        ))}

        {upcomingBirthdays.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Upcoming ({totalUpcoming})
            </p>
            {upcomingBirthdays.slice(0, 5).map((group) => (
              <div key={group.date} className="mb-2">
                <p className="text-xs text-gray-400 mb-1">{group.dayLabel} — {new Date(group.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                <div className="space-y-1">
                  {group.people.map((person) => (
                    <div key={`upcoming-${person.type}-${person.id}`} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40">
                      <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 text-xs font-bold shrink-0">
                        {person.fullName.charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700 truncate flex-1">
                        {person.fullName}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">
                        {person.type === 'student' ? 'Student' : 'Teacher'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {upcomingBirthdays.length > 5 && (
              <p className="text-xs text-center text-amber-600 mt-1">
                +{upcomingBirthdays.length - 5} more days with birthdays
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BirthdayWidget;
