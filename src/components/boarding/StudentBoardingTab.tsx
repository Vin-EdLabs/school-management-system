import React, { useEffect, useState } from 'react';
import {
  BedDouble,
  DoorOpen,
  Stethoscope,
  ClipboardList,
  UtensilsCrossed,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { boardingService, type StudentBoardingSummary } from '@/services/boardingService';
import { formatDisplayDate } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';

interface StudentBoardingTabProps {
  studentId: string;
}

export const StudentBoardingTab: React.FC<StudentBoardingTabProps> = ({ studentId }) => {
  const [summary, setSummary] = useState<StudentBoardingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!studentId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await boardingService.getStudentSummary(studentId);
      setSummary(data);
    } catch (e) {
      setError((e as Error).message);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-slate-50/20 border border-dashed rounded-2xl">
        <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
        <p className="text-xs text-slate-400 mt-2">Loading boarding details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const enrollment = summary?.enrollment;

  if (!enrollment) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
        <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-medium">No boarding enrollment for the current term</p>
        <p className="text-xs mt-1">Enroll this student from the Boarders module.</p>
      </div>
    );
  }

  const statusBadge =
    enrollment.status === 'boarder'
      ? 'bg-emerald-100 text-emerald-800 border-0'
      : 'bg-slate-100 text-slate-600 border-0';

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-slate-200 shadow-sm border-l-[6px] border-l-emerald-500">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className={statusBadge}>{enrollment.status === 'boarder' ? 'Boarder' : 'Day student'}</Badge>
              {enrollment.converted_from ? (
                <Badge variant="outline" className="text-[10px] capitalize">
                  From {enrollment.converted_from}
                </Badge>
              ) : null}
            </div>
            {enrollment.status === 'boarder' ? (
              <p className="text-sm text-slate-600 mt-2 flex items-center gap-1.5">
                <BedDouble className="h-4 w-4 text-emerald-600" />
                {[enrollment.dorm_name, enrollment.room_name, enrollment.bed_number ? `Bed ${enrollment.bed_number}` : null]
                  .filter(Boolean)
                  .join(' · ') || 'Bed not assigned'}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">Day student — no dorm assignment</p>
            )}
            {enrollment.start_date ? (
              <p className="text-xs text-muted-foreground mt-1">Since {formatDisplayDate(enrollment.start_date)}</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-border shadow-sm dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DoorOpen className="h-4 w-4 text-violet-600" />
              Recent exeats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!summary?.recent_exeats?.length ? (
              <p className="text-xs text-muted-foreground">No exeat history</p>
            ) : (
              summary.recent_exeats.slice(0, 5).map((x) => (
                <div key={x.id} className="flex justify-between items-start gap-2 text-sm border-b last:border-0 pb-2">
                  <div>
                    <p className="font-medium capitalize">{x.status.replace('_', ' ')}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDisplayDate(x.departure_date, '—')} → {formatDisplayDate(x.return_date, '—')}
                    </p>
                  </div>
                  {x.destination ? <span className="text-xs text-muted-foreground truncate max-w-[8rem]">{x.destination}</span> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-amber-600" />
              Sick bay
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!summary?.sick_bay_records?.length ? (
              <p className="text-xs text-muted-foreground">No sick bay visits recorded</p>
            ) : (
              summary.sick_bay_records.slice(0, 5).map((r) => (
                <div key={r.id} className="text-sm border-b last:border-0 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-[10px] border-0', r.status === 'recovered' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>
                      {r.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDisplayDate(r.reported_date)}</span>
                  </div>
                  {r.symptoms ? <p className="text-xs mt-1 text-muted-foreground">{r.symptoms}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              Roll call (term)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {summary?.roll_call_summary ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-lg font-bold text-emerald-800">{summary.roll_call_summary.present}</p>
                  <p className="text-[10px] uppercase text-emerald-600">Present</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-lg font-bold text-slate-700">{summary.roll_call_summary.absent}</p>
                  <p className="text-[10px] uppercase text-slate-500">Absent</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-lg font-bold text-amber-800">{summary.roll_call_summary.flagged}</p>
                  <p className="text-[10px] uppercase text-amber-600">Flagged</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No roll call data yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm dark:bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4 text-sky-600" />
              This week&apos;s menu
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {summary?.weekly_menu?.items?.length ? (
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-2 font-medium">Day</th>
                    <th className="py-1 pr-2 font-medium">Breakfast</th>
                    <th className="py-1 pr-2 font-medium">Lunch</th>
                    <th className="py-1 font-medium">Dinner</th>
                  </tr>
                </thead>
                <tbody>
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((day) => {
                    const labels = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                    const get = (meal: 'breakfast' | 'lunch' | 'dinner') =>
                      summary.weekly_menu?.items.find((i) => i.day_of_week === day && i.meal_type === meal)?.menu_item || '—';
                    return (
                      <tr key={day} className="border-b last:border-0">
                        <td className="py-1.5 pr-2 font-medium">{labels[day]}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">{get('breakfast')}</td>
                        <td className="py-1.5 pr-2 text-muted-foreground">{get('lunch')}</td>
                        <td className="py-1.5 text-muted-foreground">{get('dinner')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">No weekly menu published yet</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              Complaints (parent-visible)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!summary?.complaints?.length ? (
              <p className="text-xs text-muted-foreground">No complaints on file</p>
            ) : (
              summary.complaints.slice(0, 5).map((c) => (
                <div key={c.id} className="text-sm border-b last:border-0 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{c.title}</p>
                    <Badge className={cn('text-[10px] border-0', c.severity === 'high' ? 'bg-red-100 text-red-800' : c.severity === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700')}>
                      {c.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.status.replace('_', ' ')}</Badge>
                  </div>
                  {c.parent_summary ? <p className="text-xs text-muted-foreground mt-1">{c.parent_summary}</p> : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentBoardingTab;
