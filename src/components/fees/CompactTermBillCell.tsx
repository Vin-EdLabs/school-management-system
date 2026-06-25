import React, { memo, useState, startTransition } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import TermBillBreakdown from './TermBillBreakdown';

type CompactTermBillCellProps = {
  total: number;
  feeStructureId?: string | null;
  individualCharges?: Array<{
    id: number;
    description: string;
    amount: number;
    date?: string | null;
    status?: string | null;
    reason?: string | null;
  }>;
  individualChargeAmount?: number;
  studentId?: number | string;
  termId?: number | null;
  discountAmount?: number;
  discountLabel?: string;
};

const formatMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CompactTermBillCell: React.FC<CompactTermBillCellProps> = ({
  total,
  feeStructureId,
  individualCharges,
  individualChargeAmount,
  studentId,
  termId,
  discountAmount,
  discountLabel,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);

  const canExpand = Boolean(
    feeStructureId ||
      (individualCharges && individualCharges.length > 0) ||
      Number(individualChargeAmount ?? 0) > 0 ||
      (studentId != null && termId != null)
  );

  const openBreakdown = () => {
    if (!canExpand || expanded) return;
    setPending(true);
    startTransition(() => {
      setExpanded(true);
      setPending(false);
    });
  };

  if (!expanded) {
    return (
      <div className="inline-flex flex-col items-end gap-0.5">
        <span className="font-mono tabular-nums font-medium">
          GHS {formatMoney(total)}
        </span>
        {canExpand ? (
          <button
            type="button"
            onClick={openBreakdown}
            disabled={pending}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline dark:text-emerald-400 self-end"
          >
            {pending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                View breakdown
                <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <TermBillBreakdown
      total={total}
      feeStructureId={feeStructureId}
      individualCharges={individualCharges}
      individualChargeAmount={individualChargeAmount}
      studentId={studentId}
      termId={termId}
      compact
      defaultExpanded
      discountAmount={discountAmount}
      discountLabel={discountLabel}
    />
  );
};

export default memo(CompactTermBillCell);
