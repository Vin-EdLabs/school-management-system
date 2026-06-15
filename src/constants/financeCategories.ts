export const OTHER_CATEGORY = 'Other';

export const DEFAULT_INCOME_CATEGORIES = [
  'School Fees',
  'PTA Levy',
  'Donation',
  'Grant',
  'Sales',
  'Rental',
  'Feeding',
  'Transport',
  OTHER_CATEGORY,
] as const;

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Salaries',
  'Utilities',
  'Maintenance',
  'Supplies',
  'Feeding',
  'Transport',
  'Equipment',
  'Events',
  'Security',
  OTHER_CATEGORY,
] as const;

/** Internal/budget-only labels — hidden from income/expense dropdowns. */
export const HIDDEN_INCOME_CATEGORY_KEYS = new Set([
  'expected fee income',
  'fee payment',
]);

export function getDefaultCategories(type: 'income' | 'expense'): readonly string[] {
  return type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
}

export function isReservedCategoryName(name: string): boolean {
  return String(name || '').trim().toLowerCase() === OTHER_CATEGORY.toLowerCase();
}
