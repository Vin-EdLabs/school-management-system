const SUBJECT_COLORS = [
  'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
  'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
  'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/30',
  'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
  'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/30',
  'bg-cyan-100 text-cyan-900 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:border-cyan-500/30',
  'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:border-indigo-500/30',
  'bg-orange-100 text-orange-900 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30',
  'bg-teal-100 text-teal-900 border-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:border-teal-500/30',
  'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-200 dark:bg-fuchsia-500/15 dark:text-fuchsia-300 dark:border-fuchsia-500/30',
];

const CLASS_COLORS = [
  'border-l-blue-500',
  'border-l-emerald-500',
  'border-l-violet-500',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-cyan-500',
  'border-l-indigo-500',
  'border-l-orange-500',
];

export function subjectColor(subjectId: number): string {
  const idx = Math.abs(subjectId) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[idx];
}

export function classAccentColor(classId: number): string {
  const idx = Math.abs(classId) % CLASS_COLORS.length;
  return CLASS_COLORS[idx];
}

export function formatTimeLabel(value: string | null | undefined): string {
  if (!value) return '';
  const parts = String(value).split(':');
  if (parts.length < 2) return value;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTimeLabel(start)} – ${formatTimeLabel(end)}`;
}

/** 24-hour compact range for timetable grid, e.g. 07:00 – 07:45 */
export function formatTimeRangeCompact(start: string, end: string): string {
  const compact = (value: string | null | undefined): string => {
    if (!value) return '';
    const parts = String(value).split(':');
    return `${parts[0]?.padStart(2, '0') || '00'}:${parts[1]?.padStart(2, '0') || '00'}`;
  };
  return `${compact(start)} – ${compact(end)}`;
}

export function formatExamDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function toInputTime(value: string | null | undefined): string {
  if (!value) return '';
  const parts = String(value).split(':');
  return `${parts[0]?.padStart(2, '0') || '00'}:${parts[1]?.padStart(2, '0') || '00'}`;
}

export const TIMETABLE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export const timetableNativeSelectClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export const timetableCardClass =
  'rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-700/80 dark:bg-slate-900/90';

export const timetableMutedPanelClass =
  'rounded-2xl border border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-800/50';

export const timetableEmptyStateClass =
  'rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-900/60';

export const timetableLabelClass =
  'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400';

export const timetableTabsListClass =
  'inline-flex h-auto flex-wrap gap-1 rounded-xl bg-slate-100/80 p-1 dark:bg-slate-800/80 dark:border dark:border-slate-700/50';

export const timetablePageTitleClass =
  'text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-slate-100';

export const timetablePageSubtitleClass =
  'text-sm text-slate-500 dark:text-slate-400';

export function classDisplayName(c: {
  className?: string;
  name?: string;
  class_name?: string;
}): string {
  return c.className || c.name || c.class_name || 'Unnamed class';
}

function parseTimeToMinutes(value: string): number {
  const parts = String(value || '').split(':');
  return parseInt(parts[0] || '0', 10) * 60 + parseInt(parts[1] || '0', 10);
}

const WEEKDAY_TO_TIMETABLE: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
};

/** Next upcoming lesson today from a teacher grid (client-side preview). */
export function findNextClassToday(grid: {
  periods: Array<{ id: number; start_time: string; end_time: string; is_break?: boolean; name?: string }>;
  slots: Array<{ day_of_week: string; period_id: number; subject_name?: string; class_name?: string }>;
}): {
  subject_name: string;
  class_name: string;
  period_name: string;
  start_time: string;
  end_time: string;
  minutesUntil: number;
} | null {
  const today = WEEKDAY_TO_TIMETABLE[new Date().getDay()];
  if (!today) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const periodMap = new Map(grid.periods.map((p) => [p.id, p]));

  let best: {
    subject_name: string;
    class_name: string;
    period_name: string;
    start_time: string;
    end_time: string;
    minutesUntil: number;
  } | null = null;

  for (const slot of grid.slots) {
    if (slot.day_of_week !== today) continue;
    const period = periodMap.get(slot.period_id);
    if (!period || period.is_break) continue;
    const startMinutes = parseTimeToMinutes(period.start_time);
    const minutesUntil = startMinutes - nowMinutes;
    if (minutesUntil < -5) continue;
    if (!best || minutesUntil < best.minutesUntil) {
      best = {
        subject_name: slot.subject_name || 'Lesson',
        class_name: slot.class_name || 'Class',
        period_name: period.name || 'Period',
        start_time: period.start_time,
        end_time: period.end_time,
        minutesUntil,
      };
    }
  }
  return best;
}
