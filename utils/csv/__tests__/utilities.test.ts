import { describe, it, expect } from 'vitest';
import { splitSemicolonCsv } from '../splitSemicolonCsv';
import { toBool } from '../toBool';
import { toNum } from '../toNum';
import { parseTireType } from '../parseTireType';
import { parseTireStatus } from '../parseTireStatus';
import { parseExpenseCategory } from '../parseExpenseCategory';

describe('splitSemicolonCsv', () => {
  it('splits simple fields', () => {
    expect(splitSemicolonCsv('a;b;c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields', () => {
    expect(splitSemicolonCsv('"hello";world')).toEqual(['hello', 'world']);
  });

  it('handles semicolons inside quotes', () => {
    expect(splitSemicolonCsv('"a;b";c')).toEqual(['a;b', 'c']);
  });

  it('handles empty fields', () => {
    expect(splitSemicolonCsv('a;;c')).toEqual(['a', '', 'c']);
  });

  it('handles empty string', () => {
    expect(splitSemicolonCsv('')).toEqual(['']);
  });

  it('handles quoted field at end of line', () => {
    expect(splitSemicolonCsv('a;"last"')).toEqual(['a', 'last']);
  });

  it('handles multiple quoted fields', () => {
    expect(splitSemicolonCsv('"first";"second"')).toEqual(['first', 'second']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(splitSemicolonCsv('"hello ""world""";test')).toEqual(['hello "world"', 'test']);
  });
});

describe('toBool', () => {
  it('returns true for truthy values', () => {
    expect(toBool('1')).toBe(true);
    expect(toBool('true')).toBe(true);
    expect(toBool('TRUE')).toBe(true);
    expect(toBool('yes')).toBe(true);
    expect(toBool('YES')).toBe(true);
  });

  it('returns false for falsy values', () => {
    expect(toBool('0')).toBe(false);
    expect(toBool('false')).toBe(false);
    expect(toBool('')).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });
});

describe('toNum', () => {
  it('parses integers', () => {
    expect(toNum('123')).toBe(123);
  });

  it('parses decimals with dot', () => {
    expect(toNum('12.34')).toBe(12.34);
  });

  it('parses decimals with comma', () => {
    expect(toNum('12,34')).toBe(12.34);
  });

  it('returns undefined for invalid input', () => {
    expect(toNum('')).toBeUndefined();
    expect(toNum(undefined)).toBeUndefined();
    expect(toNum('abc')).toBeUndefined();
  });
});

describe('parseTireType', () => {
  it('parses summer tires', () => {
    expect(parseTireType('SUMMER')).toBe('SUMMER');
    expect(parseTireType('summer')).toBe('SUMMER');
  });

  it('parses winter tires', () => {
    expect(parseTireType('WINTER')).toBe('WINTER');
    expect(parseTireType('winter')).toBe('WINTER');
  });

  it('parses all season tires', () => {
    expect(parseTireType('ALL_SEASON')).toBe('ALL_SEASON');
    expect(parseTireType('all_season')).toBe('ALL_SEASON');
  });

  it('returns undefined for invalid type', () => {
    expect(parseTireType('invalid')).toBeUndefined();
    expect(parseTireType('')).toBeUndefined();
  });
});

describe('parseTireStatus', () => {
  it('parses active status', () => {
    expect(parseTireStatus('ACTIVE')).toBe('ACTIVE');
    expect(parseTireStatus('active')).toBe('ACTIVE');
  });

  it('parses stored status', () => {
    expect(parseTireStatus('STORED')).toBe('STORED');
    expect(parseTireStatus('stored')).toBe('STORED');
  });

  it('parses retired status', () => {
    expect(parseTireStatus('RETIRED')).toBe('RETIRED');
    expect(parseTireStatus('retired')).toBe('RETIRED');
  });

  it('returns undefined for invalid status', () => {
    expect(parseTireStatus('invalid')).toBeUndefined();
    expect(parseTireStatus('')).toBeUndefined();
  });
});

describe('parseExpenseCategory', () => {
  it('parses maintenance category', () => {
    expect(parseExpenseCategory('MAINTENANCE')).toBe('MAINTENANCE');
    expect(parseExpenseCategory('maintenance')).toBe('MAINTENANCE');
  });

  it('parses insurance category', () => {
    expect(parseExpenseCategory('INSURANCE')).toBe('INSURANCE');
  });

  it('parses parking category', () => {
    expect(parseExpenseCategory('PARKING')).toBe('PARKING');
  });

  it('parses oil categories', () => {
    expect(parseExpenseCategory('OIL_CHANGE')).toBe('OIL_CHANGE');
    expect(parseExpenseCategory('OIL_TOP_UP')).toBe('OIL_TOP_UP');
  });

  it('defaults to MAINTENANCE for unknown categories', () => {
    expect(parseExpenseCategory('unknown')).toBe('MAINTENANCE');
    expect(parseExpenseCategory('')).toBe('MAINTENANCE');
  });
});
