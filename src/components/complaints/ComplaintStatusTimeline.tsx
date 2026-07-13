import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatComplaintWhen,
  statusLabel,
  type ComplaintHistoryItem,
  type ComplaintStatus,
} from '@/services/complaintsService';

const STEPS: ComplaintStatus[] = ['pending', 'under_review', 'resolved'];

type Props = {
  current: ComplaintStatus;
  history?: ComplaintHistoryItem[];
};

function timestampFor(status: ComplaintStatus, history?: ComplaintHistoryItem[]) {
  const hit = [...(history || [])].reverse().find((h) => h.new_status === status);
  return hit?.created_at || null;
}

const ComplaintStatusTimeline: React.FC<Props> = ({ current, history }) => {
  const currentIdx = STEPS.indexOf(current);

  return (
    <ol className="space-y-0">
      {STEPS.map((step, idx) => {
        const done = idx <= currentIdx;
        const active = idx === currentIdx;
        const ts = timestampFor(step, history);
        return (
          <li key={step} className="relative flex gap-3 pb-5 last:pb-0">
            {idx < STEPS.length - 1 && (
              <span
                className={cn(
                  'absolute left-[11px] top-6 h-[calc(100%-8px)] w-0.5',
                  idx < currentIdx ? 'bg-emerald-500' : 'bg-border'
                )}
              />
            )}
            <div className="relative z-10 mt-0.5 shrink-0">
              {done ? (
                <CheckCircle2 className={cn('h-6 w-6', active && current !== 'resolved' ? 'text-amber-600' : 'text-emerald-600')} />
              ) : (
                <Circle className="h-6 w-6 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <p className={cn('text-sm font-semibold', done ? 'text-foreground' : 'text-muted-foreground')}>
                {statusLabel(step)}
              </p>
              {ts ? (
                <p className="text-xs text-muted-foreground mt-0.5">{formatComplaintWhen(ts)}</p>
              ) : (
                <p className="text-xs text-muted-foreground/60 mt-0.5">Not reached</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default ComplaintStatusTimeline;
