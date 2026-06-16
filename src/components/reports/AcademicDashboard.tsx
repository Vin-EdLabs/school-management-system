import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from 'recharts';
import { Trophy, Users, Star, CalendarDays, TrendingUp, ArrowUpRight } from 'lucide-react';
import { formatDisplayDate } from '@/utils/dateFormat';

export type AcademicPerformanceData = {
  schoolAverage?: number;
  classPerformance?: Array<{ name?: string; score?: number | string }>;
  topPerformers?: Array<{ name?: string; class?: string; score?: number | string }>;
};

export interface AcademicDashboardProps {
  schoolName?: string | null;
  activeTerm: string;
  academicYearLabel: string;
  performance: AcademicPerformanceData | null;
  attendance: Array<{ date?: string; rate?: number }>;
  feesByClass: Array<{ students?: number | string }>;
}

const toNumber = (value: number | string | undefined | null) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const AcademicDashboard: React.FC<AcademicDashboardProps> = ({
  schoolName,
  activeTerm,
  academicYearLabel,
  performance,
  attendance,
  feesByClass,
}) => {
  const totalStudents = useMemo(
    () => feesByClass.reduce((sum, row) => sum + toNumber(row.students), 0),
    [feesByClass]
  );

  const averageAttendance = useMemo(() => {
    if (!attendance.length) return 0;
    return attendance.reduce((sum, row) => sum + toNumber(row.rate), 0) / attendance.length;
  }, [attendance]);

  const classPerformance = performance?.classPerformance?.map((row) => ({
    name: row.name || 'Unknown',
    score: Number(row.score || 0),
  })) || [];

  const topPerformers = performance?.topPerformers?.map((row) => ({
    name: row.name || 'Unknown',
    className: row.class || '—',
    score: Number(row.score || 0),
  })) || [];

  const classesAboveTarget = classPerformance.filter((row) => row.score >= 80).length;
  const classesAtRisk = classPerformance.filter((row) => row.score < 60).length;
  const classCount = classPerformance.length;
  const distribution = useMemo(() => {
    const buckets = { excellent: 0, strong: 0, developing: 0, atRisk: 0 };
    classPerformance.forEach((row) => {
      if (row.score >= 90) buckets.excellent += 1;
      else if (row.score >= 80) buckets.strong += 1;
      else if (row.score >= 70) buckets.developing += 1;
      else buckets.atRisk += 1;
    });
    return buckets;
  }, [classPerformance]);

  const attendanceTrend = attendance.map((row) => ({
    date: row.date || '',
    rate: Number(row.rate || 0),
  }));

  return (
    <div className="space-y-8">
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="luxury-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">School average score</p>
              <p className="mt-3 text-3xl font-bold report-number-font">{Math.round(performance?.schoolAverage ?? 0)}%</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10 text-blue-600">
              <Star size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Class performance across current term and year.</p>
        </div>

        <div className="luxury-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">Average attendance</p>
              <p className="mt-3 text-3xl font-bold report-number-font">{Math.round(averageAttendance)}%</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10 text-emerald-600">
              <CalendarDays size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Daily attendance quality for the selected academic window.</p>
        </div>

        <div className="luxury-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">Total students</p>
              <p className="mt-3 text-3xl font-bold report-number-font">{totalStudents.toLocaleString()}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-900">
              <Users size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Registered learners across classes in your academic year.</p>
        </div>

        <div className="luxury-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">High-performing classes</p>
              <p className="mt-3 text-3xl font-bold report-number-font">{classesAboveTarget}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10 text-emerald-600">
              <Trophy size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Classes with a 80% or higher average score.</p>
        </div>

        <div className="luxury-card p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">Classes tracked</p>
              <p className="mt-3 text-3xl font-bold report-number-font">{classCount}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/10 text-slate-700">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="mt-4 text-sm text-[var(--report-text-secondary)]">Academic groups included in the current summary.</p>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 luxury-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold report-header-font">Class performance review</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">Score distribution and class-level trends for {activeTerm} · {academicYearLabel}</p>
            </div>
            <span className="text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">{schoolName ?? 'School'}</span>
          </div>

          <div className="h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classPerformance.slice(0, 10)} margin={{ top: 16, right: 18, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--report-chart-grid)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--report-chart-tick)', fontSize: 12 }} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--report-chart-tick)', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip wrapperStyle={{ zIndex: 10 }} contentStyle={{ borderRadius: 10, background: 'var(--report-card-bg)', borderColor: 'var(--report-card-border)' }} />
                <Bar dataKey="score" radius={[8, 8, 0, 0]} fill="#3b82f6">
                  {classPerformance.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#10b981' : entry.score >= 60 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="luxury-card p-6">
          <h3 className="text-xl font-bold report-header-font mb-4">Academic health</h3>
          <div className="space-y-4">
            {[
              { label: 'Excellent (90+)', value: distribution.excellent, color: 'emerald' },
              { label: 'Strong (80-89)', value: distribution.strong, color: 'blue' },
              { label: 'Developing (70-79)', value: distribution.developing, color: 'amber' },
              { label: 'At-risk (<70)', value: distribution.atRisk, color: 'red' },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-[var(--report-text-primary)]">
                  <span>{item.label}</span>
                  <span>{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full ${item.color === 'emerald' ? 'bg-emerald-500' : item.color === 'blue' ? 'bg-blue-500' : item.color === 'amber' ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, (item.value / Math.max(1, classCount)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="luxury-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold report-header-font">Attendance trend</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">Recent attendance performance for the selected period.</p>
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">Avg {Math.round(averageAttendance)}%</div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceTrend} margin={{ top: 12, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--report-chart-tick)', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--report-chart-tick)', fontSize: 11 }} domain={[0, 100]} />
                <CartesianGrid strokeDasharray="3 3" stroke="var(--report-chart-grid)" vertical={false} />
                <Tooltip wrapperStyle={{ borderRadius: 10, background: 'var(--report-card-bg)', borderColor: 'var(--report-card-border)' }} />
                <Area type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} fill="url(#attendanceGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="luxury-card p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold report-header-font">Top academic performers</h3>
              <p className="text-sm text-[var(--report-text-secondary)]">Highest average student scores in the current term.</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[var(--report-text-secondary)]">Top {Math.min(5, topPerformers.length)}</div>
          </div>
          <div className="space-y-4">
            {topPerformers.slice(0, 5).map((student, index) => (
              <div key={student.name + index} className="flex items-center justify-between gap-4 p-3 rounded-2xl border border-[var(--report-card-border)]">
                <div>
                  <p className="font-semibold">{student.name}</p>
                  <p className="text-[11px] text-[var(--report-text-secondary)]">{student.className}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold report-number-font">{Math.round(student.score)}%</p>
                  <p className="text-[10px] text-[var(--report-text-secondary)]">Rank #{index + 1}</p>
                </div>
              </div>
            ))}
            {!topPerformers.length && (
              <div className="text-center text-[var(--report-text-secondary)] italic py-8">No academic performance data available yet.</div>
            )}
          </div>
        </div>
      </section>

      <div className="luxury-card overflow-hidden">
        <div className="border-b border-[var(--report-card-border)] p-6">
          <h3 className="text-xl font-bold report-header-font">Class performance detail</h3>
          <p className="mt-1 text-sm text-[var(--report-text-secondary)]">Sorted by average score for the selected academic term.</p>
        </div>
        <div className="overflow-x-auto p-4">
          <table className="luxury-table text-sm w-full">
            <thead>
              <tr>
                <th>Class</th>
                <th>Average score</th>
                <th>Risk band</th>
              </tr>
            </thead>
            <tbody>
              {classPerformance.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-[var(--report-text-secondary)] italic">No class performance information yet.</td>
                </tr>
              ) : (
                classPerformance.map((row, index) => {
                  const score = row.score;
                  const band = score >= 90 ? 'Excellent' : score >= 80 ? 'Strong' : score >= 70 ? 'Developing' : 'At-risk';
                  return (
                    <tr key={row.name + index}>
                      <td className="font-bold">{row.name}</td>
                      <td className="report-number-font">{Math.round(score)}%</td>
                      <td className={`text-xs font-semibold ${band === 'Excellent' ? 'text-emerald-600' : band === 'Strong' ? 'text-blue-600' : band === 'Developing' ? 'text-amber-600' : 'text-red-500'}`}>
                        {band}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AcademicDashboard;
