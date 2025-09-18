export const expenseCategories = [
  'FUEL',
  'MAINTENANCE',
  'INSURANCE',
  'TAX',
  'PARKING',
  'TOLL',
  'OTHER',
] as const;

export type ExpenseCategory = (typeof expenseCategories)[number];

export function isValidExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && expenseCategories.includes(value as ExpenseCategory);
}

export function normalizeExpenseCategory(input?: string | null): ExpenseCategory | undefined {
  const value = input?.trim().toUpperCase();
  if (!value) return undefined;
  return isValidExpenseCategory(value) ? (value as ExpenseCategory) : undefined;
}
