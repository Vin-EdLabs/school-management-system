/** Build a display label from term name + academic year without duplicating the year. */
export function formatTermLedgerLabel(termName: string, yearName: string): string {
  const t = String(termName || '').trim();
  const y = String(yearName || '').trim();
  if (!t) return y;
  if (!y || t.endsWith(y) || t.includes(y)) return t;
  return `${t} ${y}`.trim();
}
