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

export function getDefaultCategories(type: 'income' | 'expense'): readonly string[] {
  return type === 'income' ? DEFAULT_INCOME_CATEGORIES : DEFAULT_EXPENSE_CATEGORIES;
}
