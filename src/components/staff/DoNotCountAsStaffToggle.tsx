import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { UserMinus } from 'lucide-react';

type Props = {
  /** When true, person is included in staff headcount totals. */
  countsAsStaff: boolean;
  onChange: (countsAsStaff: boolean) => void;
  id?: string;
};

const DoNotCountAsStaffToggle: React.FC<Props> = ({ countsAsStaff, onChange, id = 'do-not-count-staff' }) => {
  const excludeFromCount = !countsAsStaff;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3 transition-all duration-200 md:col-span-2',
        excludeFromCount
          ? 'border-red-300/70 bg-red-50/90 shadow-sm shadow-red-500/10 dark:border-red-800/60 dark:bg-red-950/35'
          : 'border-border/70 bg-muted/20 hover:bg-muted/30'
      )}
    >
      <div
        className={cn(
          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          excludeFromCount
            ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400'
            : 'bg-muted text-muted-foreground'
        )}
      >
        <UserMinus className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-snug cursor-pointer">
          Do not count as staff
        </Label>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Off by default — everyone counts toward staff totals. Turn{' '}
          <span className={cn('font-medium', excludeFromCount && 'text-red-700 dark:text-red-300')}>on</span>{' '}
          for owners or non-working salaried people. They stay in the list and payroll; only dashboard
          counts and exports are affected.
        </p>
      </div>
      <Switch
        id={id}
        checked={excludeFromCount}
        onCheckedChange={(checked) => onChange(!checked)}
        className={cn(
          'mt-1 shrink-0',
          excludeFromCount && 'data-[state=checked]:bg-red-600 dark:data-[state=checked]:bg-red-600'
        )}
      />
    </div>
  );
};

export default DoNotCountAsStaffToggle;
