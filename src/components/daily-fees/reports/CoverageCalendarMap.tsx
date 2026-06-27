import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/utils/dateFormat';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type CoverageDayStatus = 'paid' | 'future' | 'unpaid' | 'closed';

export type CoverageDay = { date: string; status: CoverageDayStatus };

type Props = {
  days: CoverageDay[];
  closureDays: string[];
  termLabel: string;
};

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const STATUS_META: Record<CoverageDayStatus, { label: string; short: string; cell: string; dot: string }> = {
  paid: {
    label: 'Paid / covered',
    short: 'Covered',
    cell: 'bg-emerald-500 text-white ring-1 ring-emerald-600/30',
    dot: 'bg-emerald-500',
  },
  unpaid: {
    label: 'Past day — not paid',
    short: 'Missed',
    cell: 'bg-red-500 text-white ring-1 ring-red-600/30',
    dot: 'bg-red-500',
  },
  future: {
    label: 'Upcoming school day',
    short: 'Upcoming',
    cell: 'bg-white text-slate-500 border border-dashed border-slate-300',
    dot: 'bg-white border border-slate-300',
  },
  closed: {
    label: 'Weekend or school closed',
    short: 'No school',
    cell: 'bg-slate-100 text-slate-400 border border-slate-200',
    dot: 'bg-slate-200',
  },
};

function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function mondayColumnIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function buildMonthGrid(
  year: number,
  month: number,
  dayMap: Map<string, CoverageDayStatus>,
  closureSet: Set<string>,
  today: string
) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const cells: Array<{ date: string | null; status?: CoverageDayStatus; dayNum?: number }> = [];

  const pad = mondayColumnIndex(first);
  for (let i = 0; i < pad; i += 1) cells.push({ date: null });

  for (let d = 1; d <= last.getDate(); d += 1) {
    const current = new Date(year, month, d);
    const iso = formatIso(current);
    const mapped = dayMap.get(iso);
    let status: CoverageDayStatus;
    if (mapped) status = mapped;
    else if (isWeekend(current) || closureSet.has(iso)) status = 'closed';
    else if (iso > today) status = 'future';
    else status = 'unpaid';
    cells.push({ date: iso, status, dayNum: d });
  }

  return cells;
}

const CoverageCalendarMap: React.FC<Props> = ({ days, closureDays, termLabel }) => {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState<{ date: string; status: CoverageDayStatus } | null>(null);

  const dayMap = useMemo(() => new Map(days.map((d) => [d.date.slice(0, 10), d.status])), [days]);
  const closureSet = useMemo(() => new Set(closureDays.map((d) => d.slice(0, 10))), [closureDays]);
  const today = formatIso(new Date());

  const stats = useMemo(() => {
    const counts = { paid: 0, unpaid: 0, future: 0, closed: 0 };
    for (const d of days) counts[d.status] += 1;
    return counts;
  }, [days]);

  const months = useMemo(() => {
    if (days.length === 0) return [];
    const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
    const start = parseDateOnly(sorted[0].date);
    const end = parseDateOnly(sorted[sorted.length - 1].date);
    const list: Array<{ year: number; month: number; label: string }> = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cursor.getTime() <= endMonth.getTime()) {
      list.push({
        year: cursor.getFullYear(),
        month: cursor.getMonth(),
        label: monthLabel(cursor),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    return list;
  }, [days]);

  if (days.length === 0) {
    return <p className="py-2 text-center text-xs text-slate-500">No school days to display yet.</p>;
  }

  const activeMeta = hovered ? STATUS_META[hovered.status] : null;

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group flex w-full flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-600">
            <span className="font-medium text-slate-800">{termLabel}</span>
            <span className="text-emerald-700">{stats.paid} covered</span>
            <span className="text-red-600">{stats.unpaid} missed</span>
            <span className="text-slate-500">{stats.future} upcoming</span>
          </div>
          <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-emerald-700 group-hover:underline">
            Expand
            <ChevronDown className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="flex max-h-3 flex-wrap gap-px overflow-hidden">
          {days.map((d) => (
            <span
              key={d.date}
              className={cn('h-1.5 w-1.5 shrink-0 rounded-[1px]', STATUS_META[d.status].dot)}
              title={`${formatDisplayDate(d.date)} — ${STATUS_META[d.status].short}`}
            />
          ))}
        </div>
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Green = paid · Red = missed · Dashed = upcoming · Grey = no school
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 gap-1 px-2 text-xs text-slate-600"
          onClick={() => {
            setExpanded(false);
            setHovered(null);
          }}
        >
          Collapse
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['paid', 'unpaid', 'future', 'closed'] as CoverageDayStatus[]).map((key) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600"
          >
            <span className={cn('h-2 w-2 rounded-[2px]', STATUS_META[key].dot)} />
            {stats[key]} {STATUS_META[key].short}
          </span>
        ))}
      </div>

      <div className="min-h-[1.75rem] rounded-md bg-emerald-50/60 px-2 py-1 text-xs text-emerald-900">
        {hovered && activeMeta ? (
          <>
            <span className="font-semibold">{formatDisplayDate(hovered.date)}</span>
            <span className="mx-1.5 text-emerald-700/60">·</span>
            <span>{activeMeta.label}</span>
          </>
        ) : (
          <span className="text-slate-500">Hover a day for details</span>
        )}
      </div>

      <div className="max-h-[320px] space-y-4 overflow-y-auto overflow-x-auto pb-1 pr-1">
        {months.map(({ year, month, label }) => {
          const cells = buildMonthGrid(year, month, dayMap, closureSet, today);
          return (
            <div key={`${year}-${month}`} className="min-w-[200px]">
              <h4 className="mb-1.5 text-xs font-semibold text-slate-700">{label}</h4>
              <div className="grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((wd, i) => (
                  <div key={`${wd}-${i}`} className="text-center text-[8px] font-medium text-slate-400">
                    {wd}
                  </div>
                ))}
                {cells.map((cell, idx) => {
                  if (!cell.date || cell.status == null || cell.dayNum == null) {
                    return <div key={`empty-${idx}`} className="h-5 w-5" />;
                  }
                  const meta = STATUS_META[cell.status];
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      title={`${formatDisplayDate(cell.date)} — ${meta.label}`}
                      onMouseEnter={() => setHovered({ date: cell.date!, status: cell.status! })}
                      onMouseLeave={() => setHovered(null)}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded text-[8px] font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500',
                        meta.cell
                      )}
                    >
                      {cell.dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CoverageCalendarMap;
