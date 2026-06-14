/** Shared display labels for budget categories across Budget, Income, and Expenses. */
export function getCategoryDisplayName(name: string): string {
  const n = String(name || '').trim();
  if (n.toLowerCase() === 'expected fee income') return 'School Fees';
  return n;
}

export function formatCategoryActualLabel(
  name: string,
  amount: number,
  type: 'income' | 'expense'
): string {
  const label = getCategoryDisplayName(name);
  const formatted = `GHS ${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  return type === 'income'
    ? `${label}: ${formatted} collected`
    : `${label}: ${formatted} spent`;
}
