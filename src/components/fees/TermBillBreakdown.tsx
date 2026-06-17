import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import {
  fetchFeeStructureItemsSummary,
  formatFeeItemLabel,
  type FeeStructureItemsSummary,
} from '../../services/feeStructureItems';
import { fetchStudentCharges, type StudentCharge } from '../../services/studentCharges';

type TermBillBreakdownProps = {
  total: number;
  feeStructureId?: string | number | null;
  /** Pre-loaded summary skips fetch on expand */
  summary?: FeeStructureItemsSummary | null;
  /** Inline items (e.g. from parent portal) — skips API fetch */
  breakdownItems?: Array<{ item_name?: string; label?: string; amount: number }>;
  /** Inline individual charges for the term */
  individualCharges?: Array<{
    id: number;
    description: string;
    amount: number;
    date?: string | null;
    status?: string | null;
    reason?: string | null;
  }>;
  credit?: number;
  studentId?: number | string;
  termId?: number | null;
  className?: string;
  compact?: boolean;
};

const formatMoney = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const TermBillBreakdown: React.FC<TermBillBreakdownProps> = ({
  total,
  feeStructureId,
  summary: summaryProp,
  breakdownItems,
  individualCharges,
  credit,
  studentId,
  termId,
  className = '',
  compact = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState<FeeStructureItemsSummary | null>(summaryProp ?? null);
  const [loading, setLoading] = useState(false);
  const [loadedCharges, setLoadedCharges] = useState<StudentCharge[] | null>(
    individualCharges ?? null
  );

  const propChargeTotal = (individualCharges ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
  const loadedChargeTotal = (loadedCharges ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
  const chargeTotal = propChargeTotal > 0 ? propChargeTotal : loadedChargeTotal;

  const displayTotal = (summaryProp?.total ?? summary?.total ?? total) + chargeTotal;

  const handleToggle = async () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) return;

    const needsSummary = !summary && !breakdownItems?.length && !!feeStructureId;
    const needsCharges = loadedCharges === null && studentId != null && termId != null;
    if (!needsSummary && !needsCharges) return;

    setLoading(true);
    try {
      const promises = [] as Promise<unknown>[];
      if (needsSummary && feeStructureId) {
        promises.push(
          fetchFeeStructureItemsSummary(feeStructureId).then((data) => setSummary(data)).catch(() => setSummary(null))
        );
      }
      if (needsCharges) {
        promises.push(
          fetchStudentCharges(studentId, termId)
            .then((charges) => setLoadedCharges(charges))
            .catch(() => setLoadedCharges([]))
        );
      }
      await Promise.all(promises);
    } finally {
      setLoading(false);
    }
  };

  const activeItems =
    breakdownItems?.map(item => ({
      item_name: item.item_name || item.label || '',
      amount: Number(item.amount),
    })) ??
    summaryProp?.items ??
    summary?.items ??
    [];
  const creditAmount = Number(credit ?? 0);
  const propCharges = individualCharges ?? [];
  const charges = propCharges.length > 0 ? propCharges : loadedCharges ?? [];

  const canExpand = Boolean(
    feeStructureId || breakdownItems?.length || propCharges.length > 0 || creditAmount > 0 || (studentId != null && termId != null)
  );

  return (
    <div className={className}>
      <div className={compact ? 'inline-flex flex-col items-end gap-0.5' : 'space-y-1'}>
        <div className={compact ? 'text-right' : 'flex items-center justify-between gap-2'}>
          {!compact && (
            <span className="text-sm text-muted-foreground">Total Term Bill</span>
          )}
          <span className={`font-mono tabular-nums ${compact ? 'font-medium' : 'font-semibold'}`}>
            GHS {formatMoney(displayTotal)}
          </span>
        </div>
        {canExpand ? (
          <button
            type="button"
            onClick={() => void handleToggle()}
            className={`inline-flex items-center gap-1 text-xs text-emerald-700 hover:text-emerald-900 underline-offset-2 hover:underline dark:text-emerald-400 ${compact ? 'self-end' : ''}`}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                View breakdown
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </>
            )}
          </button>
        ) : null}
      </div>
      {expanded && (activeItems.length > 0 || charges.length > 0 || creditAmount > 0) && (
        <div className={`mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs ${compact ? 'text-right' : ''}`}>
          {activeItems.map(item => (
            <div key={item.item_name} className="flex justify-between gap-4">
              <span className="text-muted-foreground">{formatFeeItemLabel(item.item_name)}</span>
              <span className="font-mono tabular-nums">GHS {formatMoney(Number(item.amount))}</span>
            </div>
          ))}

          {charges.length > 0 && (
            <div className="pt-2">
              <div className="text-xs text-muted-foreground mb-1">── Individual Charges ──</div>
              <div className="space-y-1">
                {charges.map((c: any) => (
                  <div key={`charge-${c.id}`} className="flex justify-between gap-4">
                    <div className="text-muted-foreground">
                      <div>{c.description}</div>
                      {c.reason ? <div className="text-[11px] text-muted-foreground/70 mt-0.5">{c.reason}</div> : null}
                    </div>
                    <div className="text-right">
                      <div className="font-mono tabular-nums">GHS {formatMoney(Number(c.amount))}</div>
                      {c.status ? (
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                          {c.status}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {creditAmount > 0 && (
            <div className="pt-2">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Credit Balance</span>
                <span className="font-mono tabular-nums text-blue-700">-GHS {formatMoney(creditAmount)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TermBillBreakdown;
