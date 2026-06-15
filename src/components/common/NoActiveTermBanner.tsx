import React from 'react';
import { CalendarClock } from 'lucide-react';
import { useActiveTerm } from '../../contexts/ActiveTermContext';

export function NoActiveTermBanner({
  inSettings = false,
  onOpenSettings,
}: {
  inSettings?: boolean;
  onOpenSettings?: () => void;
}) {
  const { isLoading } = useActiveTerm();

  if (isLoading) return null;

  return (
    <div className="mb-4 flex flex-col gap-2 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-sm flex-1">
          <p className="font-semibold">No active academic term</p>
          <p className="mt-0.5 text-sky-800 dark:text-sky-200">
            {inSettings
              ? 'Set up your academic year and activate a term here first. All other modules stay locked until a term is active.'
              : 'You must set and activate an academic term before adding students, recording income or expenses, or using other features. Open Settings → Academic Terms to get started.'}
          </p>
        </div>
      </div>
      {!inSettings && onOpenSettings ? (
        <button
          type="button"
          className="readonly-allowed self-start text-xs font-semibold text-sky-900 underline dark:text-sky-200"
          onClick={onOpenSettings}
        >
          Open Settings to set active term
        </button>
      ) : null}
    </div>
  );
}

export default NoActiveTermBanner;
