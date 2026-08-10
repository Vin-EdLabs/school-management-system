import React from 'react';
import { BedDouble, UtensilsCrossed } from 'lucide-react';

export type BoardingFeeBreakdown = {
  lodging: number;
  feeding: number;
};

type BoardingFeeBreakdownDisplayProps = {
  breakdown: BoardingFeeBreakdown;
  total?: number;
  compact?: boolean;
  showHeader?: boolean;
  className?: string;
};

const formatMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const boardingFeeBreakdownTotal = (breakdown?: BoardingFeeBreakdown | null) =>
  Math.round(((breakdown?.lodging ?? 0) + (breakdown?.feeding ?? 0)) * 100) / 100;

export const BoardingFeeBreakdownDisplay: React.FC<BoardingFeeBreakdownDisplayProps> = ({
  breakdown,
  total,
  compact = false,
  showHeader = true,
  className = '',
}) => {
  const lodging = Number(breakdown.lodging) || 0;
  const feeding = Number(breakdown.feeding) || 0;
  const computedTotal = total ?? boardingFeeBreakdownTotal(breakdown);
  if (computedTotal <= 0) return null;

  const textSize = compact ? 'text-xs' : 'text-sm';
  const rowClass = `flex justify-between gap-4 ${textSize}`;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {showHeader ? (
        <div className={`flex items-center justify-between gap-2 font-semibold text-emerald-800 dark:text-emerald-200 ${textSize}`}>
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5 shrink-0" />
            Boarding
          </span>
          <span className="font-mono tabular-nums">GHS {formatMoney(computedTotal)}</span>
        </div>
      ) : null}
      <div className={`${compact ? 'pl-2' : 'pl-4'} space-y-1 border-l-2 border-emerald-200/80 dark:border-emerald-800/60`}>
        {lodging > 0 ? (
          <div className={rowClass}>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <BedDouble className="h-3 w-3 shrink-0 opacity-70" />
              Lodging
            </span>
            <span className="font-mono tabular-nums">GHS {formatMoney(lodging)}</span>
          </div>
        ) : null}
        {feeding > 0 ? (
          <div className={rowClass}>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <UtensilsCrossed className="h-3 w-3 shrink-0 opacity-70" />
              Feeding
            </span>
            <span className="font-mono tabular-nums">GHS {formatMoney(feeding)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default BoardingFeeBreakdownDisplay;
