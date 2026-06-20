import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function formatFeeBalanceGhs(amount: number): string {
  return `GHS ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type FeeBalanceIndicatorProps = {
  amount: number;
  className?: string;
  onClickStop?: boolean;
};

const FeeBalanceIndicator: React.FC<FeeBalanceIndicatorProps> = ({
  amount,
  className = '',
  onClickStop = false,
}) => {
  if (amount <= 0.01) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`inline-flex cursor-help items-center rounded-full bg-amber-100 p-0.5 text-amber-600 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-800/50 ${className}`}
          onClick={onClickStop ? (e) => e.stopPropagation() : undefined}
          aria-label={`Fee balance: ${formatFeeBalanceGhs(amount)} owing`}
        >
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="border-amber-200 bg-amber-50 font-medium text-amber-950 shadow-md dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
      >
        Fee balance: {formatFeeBalanceGhs(amount)} owing
      </TooltipContent>
    </Tooltip>
  );
};

export default FeeBalanceIndicator;
