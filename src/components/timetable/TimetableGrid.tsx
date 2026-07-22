import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ClassSlot, ClassTimetableGrid, Period, TimetableDay } from '@/services/timetableApi';
import { formatTimeRangeCompact, subjectColor, TIMETABLE_DAYS } from './timetableUtils';

type CellMode = 'class' | 'teacher';

const DAY_ROWS = TIMETABLE_DAYS;

function SlotCell({
  slot,
  mode,
  editMode,
  clickable,
  onClick,
}: {
  slot: ClassSlot | null;
  mode: CellMode;
  editMode: boolean;
  clickable: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        'min-h-[4.5rem] w-full min-w-[7.5rem] rounded-xl border p-2.5 text-left transition-colors',
        slot
          ? 'border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80'
          : 'border-dashed border-slate-300 bg-slate-50/60 dark:border-slate-600 dark:bg-slate-800/40',
        clickable && 'hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30 cursor-pointer',
        !clickable && 'cursor-default'
      )}
    >
      {slot ? (
        <div className="space-y-1">
          <span className={cn('inline-block rounded-md border px-2 py-0.5 text-[13px] font-bold leading-tight', subjectColor(slot.subject_id))}>
            {slot.subject_name}
          </span>
          {mode === 'class' && slot.teacher_name ? (
            <p className="text-xs text-slate-600 dark:text-slate-400">{slot.teacher_name}</p>
          ) : null}
          {mode === 'teacher' && slot.class_name ? (
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{slot.class_name}</p>
          ) : null}
        </div>
      ) : editMode ? (
        <span className="flex h-full min-h-[3.25rem] items-center justify-center text-sm font-semibold text-slate-400 dark:text-slate-500">
          [ <Plus className="mx-0.5 h-3.5 w-3.5" /> ]
        </span>
      ) : (
        <span className="block min-h-[3.25rem]" aria-hidden />
      )}
    </button>
  );
}

function PeriodHeader({
  period,
  editMode,
  onPeriodClick,
}: {
  period: Period;
  editMode: boolean;
  onPeriodClick?: (period: Period) => void;
}) {
  const label = period.name?.trim() || 'Period';
  const time = formatTimeRangeCompact(period.start_time, period.end_time);
  const clickable = Boolean(editMode && onPeriodClick);

  if (period.is_break) {
    const content = (
      <>
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-amber-900 dark:text-amber-200">
          <span aria-hidden className="mr-1">🍎</span>
          {label}
        </p>
        <p className="mt-0.5 text-[10px] font-medium tabular-nums text-amber-800 dark:text-amber-300">{time}</p>
      </>
    );
    if (!clickable) return <div className="px-2 py-2 text-center">{content}</div>;
    return (
      <button
        type="button"
        onClick={() => onPeriodClick?.(period)}
        className="w-full px-2 py-2 text-center rounded-lg transition-colors hover:bg-amber-100/80 dark:hover:bg-amber-950/40"
        title="Click to edit time slot"
      >
        {content}
      </button>
    );
  }

  const inner = (
    <>
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">{label}</p>
      <p className="mt-1 text-[10px] font-semibold tabular-nums text-slate-500 dark:text-slate-400">{time}</p>
    </>
  );

  if (!clickable) {
    return <div className="px-2 py-2 text-center">{inner}</div>;
  }

  return (
    <button
      type="button"
      onClick={() => onPeriodClick?.(period)}
      className="w-full px-2 py-2 text-center rounded-lg transition-colors hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30"
      title="Click to edit name, time, or mark as break"
    >
      {inner}
    </button>
  );
}

export default function TimetableGrid({
  grid,
  editMode = false,
  mode = 'class',
  onCellClick,
  onPeriodClick,
  onAddColumn,
  addingColumn = false,
  printView = false,
  embedded = false,
}: {
  grid: ClassTimetableGrid;
  editMode?: boolean;
  mode?: CellMode;
  onCellClick?: (day: TimetableDay, period: Period, slot: ClassSlot | null) => void;
  onPeriodClick?: (period: Period) => void;
  onAddColumn?: () => void;
  addingColumn?: boolean;
  printView?: boolean;
  embedded?: boolean;
}) {
  const days = useMemo(() => {
    const fromGrid = Array.isArray(grid.days) ? grid.days : [];
    return DAY_ROWS.filter((day) => fromGrid.length === 0 || fromGrid.includes(day));
  }, [grid.days]);

  const slotMap = useMemo(() => {
    const map = new Map<string, ClassSlot>();
    for (const slot of grid.slots) {
      map.set(`${slot.day_of_week}:${slot.period_id}`, slot);
    }
    return map;
  }, [grid.slots]);

  return (
    <div
      className={cn(
        'overflow-x-auto',
        embedded
          ? 'rounded-xl'
          : 'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/90',
        printView && 'shadow-none border-slate-300 dark:border-slate-600'
      )}
    >
      <table
        className="w-full border-collapse text-sm"
        style={{ minWidth: `${112 + grid.periods.length * 120 + (editMode && onAddColumn ? 112 : 0)}px` }}
      >
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-800/80">
            <th
              className={cn(
                'sticky left-0 z-20 w-28 min-w-[7rem] px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                'bg-slate-50/95 backdrop-blur-sm border-r border-slate-200 dark:bg-slate-900/95 dark:border-slate-700'
              )}
            >
              Day
            </th>
            {grid.periods.map((period) => (
              <th
                key={period.id}
                className={cn(
                  'min-w-[7.5rem] px-1 py-1 border-l border-slate-100 dark:border-slate-700 align-bottom',
                  period.is_break ? 'bg-amber-50/90 dark:bg-amber-950/30' : 'bg-slate-50/90 dark:bg-slate-800/80'
                )}
              >
                <PeriodHeader period={period} editMode={editMode} onPeriodClick={onPeriodClick} />
              </th>
            ))}
            {editMode && onAddColumn ? (
              <th className="min-w-[7rem] border-l border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/40 px-2 py-2 align-middle">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto w-full whitespace-normal rounded-xl border-dashed py-3 text-xs font-semibold"
                  disabled={addingColumn}
                  onClick={onAddColumn}
                >
                  <Plus className="mr-1 h-3.5 w-3.5 shrink-0" />
                  Add column
                </Button>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <tr key={day} className="border-b border-slate-100 dark:border-slate-800 last:border-0">
              <td
                className={cn(
                  'sticky left-0 z-10 align-middle px-3 py-3 border-r border-slate-200 dark:border-slate-700',
                  'bg-slate-50/95 backdrop-blur-sm dark:bg-slate-900/95'
                )}
              >
                <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100">{day}</p>
              </td>
              {grid.periods.map((period) => {
                if (period.is_break) {
                  return (
                    <td
                      key={`${day}-${period.id}`}
                      className="align-middle p-1.5 border-l border-amber-100 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20"
                    >
                      <div className="flex min-h-[4.5rem] items-center justify-center rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/80 dark:bg-amber-950/30 px-2 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">Break</p>
                      </div>
                    </td>
                  );
                }

                const slot = slotMap.get(`${day}:${period.id}`) || null;
                const clickable = Boolean(editMode && onCellClick);
                return (
                  <td key={`${day}-${period.id}`} className="align-top p-1.5 border-l border-slate-100 dark:border-slate-800">
                    <SlotCell
                      slot={slot}
                      mode={mode}
                      editMode={editMode}
                      clickable={clickable}
                      onClick={() => clickable && onCellClick?.(day, period, slot)}
                    />
                  </td>
                );
              })}
              {editMode && onAddColumn ? (
                <td className="border-l border-dashed border-slate-200 dark:border-slate-600 bg-slate-50/30 dark:bg-slate-800/20" aria-hidden />
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
