import React, { lazy, memo, Suspense, useState } from 'react';
import { ChevronDown, Loader2, Receipt } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  detailDialogContentClass,
  detailDialogHeaderClass,
  detailDialogBodyClass,
} from '@/components/ui/dialog';
import BoardingFeeBreakdownDisplay, { boardingFeeBreakdownTotal } from './BoardingFeeBreakdownDisplay';
import { prefetchFeeStructureItemsSummary } from '../../services/feeStructureItems';

const TermBillBreakdown = lazy(() => import('./TermBillBreakdown'));

type CompactTermBillCellProps = {
  total: number;
  feeStructureId?: string | null;
  studentLabel?: string;
  individualCharges?: Array<{
    id: number;
    description: string;
    amount: number;
    date?: string | null;
    status?: string | null;
    reason?: string | null;
  }>;
  individualChargeAmount?: number;
  boardingFeeAmount?: number;
  boardingFeeBreakdown?: { lodging: number; feeding: number };
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
  studentLabel,
  individualCharges,
  individualChargeAmount,
  boardingFeeAmount,
  boardingFeeBreakdown,
  studentId,
  termId,
  discountAmount,
  discountLabel,
}) => {
  const [open, setOpen] = useState(false);

  const boardingFeeTotal = boardingFeeBreakdown
    ? boardingFeeBreakdownTotal(boardingFeeBreakdown)
    : Number(boardingFeeAmount ?? 0);
  const termBillTotal = total + Number(individualChargeAmount ?? 0) + boardingFeeTotal;

  const canExpand = Boolean(
    feeStructureId ||
      (individualCharges && individualCharges.length > 0) ||
      Number(individualChargeAmount ?? 0) > 0 ||
      boardingFeeTotal > 0 ||
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
        <span className="font-mono tabular-nums font-medium text-xs">
          GHS {formatMoney(termBillTotal)}
        </span>
        {canExpand ? (
          <button
            type="button"
            onClick={openBreakdown}
            onMouseEnter={warmCache}
            onFocus={warmCache}
            className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline dark:text-emerald-400 self-end whitespace-nowrap"
          >
            Breakdown
            <ChevronDown className="h-2.5 w-2.5" />
          </button>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className={`${detailDialogContentClass} sm:max-w-md`}>
          <DialogHeader className={detailDialogHeaderClass}>
            <DialogTitle className="flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Receipt className="h-4 w-4" />
              </span>
              Term bill breakdown
            </DialogTitle>
            <DialogDescription className="text-left">
              {studentLabel ? (
                <span className="block font-medium text-foreground">{studentLabel}</span>
              ) : null}
              <span className="block text-muted-foreground">
                Itemized fees for this term
                {Number(discountAmount ?? 0) > 0 ? ' (beneficiary discounts included)' : ''}.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogBody className={`${detailDialogBodyClass} space-y-4`}>
            <div className="rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50/90 to-white px-4 py-3 dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-background">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/75 dark:text-emerald-300/80">
                Total term bill
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-900 dark:text-emerald-100">
                GHS {formatMoney(termBillTotal)}
              </p>
            </div>

            {open ? (
              <Suspense
                fallback={
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 py-10 text-sm text-muted-foreground">
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
                  boardingFeeAmount={boardingFeeAmount}
                  boardingFeeBreakdown={boardingFeeBreakdown}
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
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(CompactTermBillCell);
