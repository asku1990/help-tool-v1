import type { ExpenseDto } from '@/queries/expenses';

const EXPENSE_CATEGORIES: ExpenseDto['category'][] = [
  'FUEL',
  'MAINTENANCE',
  'INSURANCE',
  'TAX',
  'PARKING',
  'TOLL',
  'OIL_CHANGE',
  'OIL_TOP_UP',
  'INSPECTION',
  'TIRES',
  'OTHER',
];

/**
 * Parses an expense category string to ExpenseCategory enum value.
 * Defaults to 'MAINTENANCE' if not recognized.
 */
export function parseExpenseCategory(value: string): ExpenseDto['category'] {
  const normalized = value.toUpperCase().trim();
  return (EXPENSE_CATEGORIES.find(c => c === normalized) ??
    'MAINTENANCE') as ExpenseDto['category'];
}
