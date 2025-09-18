import { describe, it, expect } from 'vitest';
import { isValidExpenseCategory, normalizeExpenseCategory } from '@/utils/expenses';

describe('utils/expenses', () => {
  it('isValidExpenseCategory validates known categories', () => {
    expect(isValidExpenseCategory('FUEL')).toBe(true);
    expect(isValidExpenseCategory('OTHER')).toBe(true);
    expect(isValidExpenseCategory('unknown')).toBe(false);
    expect(isValidExpenseCategory(123 as unknown as string)).toBe(false);
  });

  it('normalizeExpenseCategory normalizes and filters invalid', () => {
    expect(normalizeExpenseCategory(' fuel ')).toBe('FUEL');
    expect(normalizeExpenseCategory('Maintenance')).toBe('MAINTENANCE');
    expect(normalizeExpenseCategory('bad')).toBeUndefined();
    expect(normalizeExpenseCategory('')).toBeUndefined();
    expect(normalizeExpenseCategory(undefined)).toBeUndefined();
    expect(normalizeExpenseCategory(null as unknown as string)).toBeUndefined();
  });
});
