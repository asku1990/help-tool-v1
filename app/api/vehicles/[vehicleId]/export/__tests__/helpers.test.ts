import { vi } from 'vitest';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  default: {},
}));

import { escapeCsvField, sanitizeForFilename } from '../route';

describe('export helpers', () => {
  it('quotes fields that contain separators or quotes', () => {
    const input = 'Value;with"special\r\nchars';
    const expected = '"Value;with""special\r\nchars"';
    expect(escapeCsvField(input)).toBe(expected);
    expect(escapeCsvField('plain')).toBe('plain');
  });

  it('sanitizes filenames by removing unsafe characters', () => {
    expect(sanitizeForFilename('My Car • 2025')).toBe('My_Car_2025');
    expect(sanitizeForFilename('__leading--trailing__')).toBe('leading--trailing');
  });
});
