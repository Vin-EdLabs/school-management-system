/**
 * Ghana Cedis display (UI). Amounts use standard minus for negatives.
 */
export function formatGhs(amount: number, opts?: { signed?: boolean }): string {
  const n = Number(amount) || 0;
  const neg = n < 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const core = `GH₵${formatted}`;
  if (opts?.signed) {
    if (n > 0) return `+${core}`;
    if (n < 0) return `−${core}`;
    return core;
  }
  return neg ? `−${core}` : core;
}

/** For override preview: negative = credit (reduces owing), positive = debit (increases owing). */
export function formatAdjustmentGhs(adjustment: number): string {
  return formatGhs(adjustment, { signed: true });
}
