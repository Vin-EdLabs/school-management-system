import React, { lazy, memo, Suspense, useState } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { prefetchFeeStructureItemsSummary } from '../../services/feeStructureItems';

const TermBillBreakdown = lazy(() => import('./TermBillBreakdown'));

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
  const [open, setOpen] = useState(false);

  const canExpand = Boolean(
    feeStructureId ||
      (individualCharges && individualCharges.length > 0) ||
      Number(individualChargeAmount ?? 0) > 0 ||
      (studentId != null && termId != null)
  );

  const warmCache = () => {
    if (feeStructureId) prefetchFeeStructureItemsSummary(feeStructureId);
  };

  const openBreakdown = () => {
    if (!canExpand) return;
    warmCache();
    setOpen(true);
  };

  return (
    <>
      <div className="inline-flex flex-col items-end gap-0.5">
        <span className="font-mono tabular-nums font-medium">
          GHS {formatMoney(total)}
        </span>
        {canExpand ? (
          <button
            type="button"
            onClick={openBreakdown}
            onMouseEnter={warmCache}
            onFocus={warmCache}
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline dark:text-emerald-400 self-end"
          >
            View breakdown
            <ChevronDown className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Term bill — GHS {formatMoney(total)}</DialogTitle>
          </DialogHeader>
          {open ? (
            <Suspense
              fallback={
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading breakdown…
                </div>
              }
            >
              <TermBillBreakdown
                total={total}
                feeStructureId={feeStructureId}
                individualCharges={individualCharges}
                individualChargeAmount={individualChargeAmount}
                studentId={studentId}
                termId={termId}
                discountAmount={discountAmount}
                discountLabel={discountLabel}
                chargesPreloaded
                panelOnly
                defaultExpanded
              />
            </Suspense>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(CompactTermBillCell);
