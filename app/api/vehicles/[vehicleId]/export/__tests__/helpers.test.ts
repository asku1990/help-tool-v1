import { escapeSpreadsheetField, sanitizeForFilename } from '../csv';

describe('export helpers', () => {
  it('quotes text fields and escapes embedded quotes', () => {
    const input = 'Value,with"special\r\nchars';
    const expected = '"Value,with""special\r\nchars"';
    expect(escapeSpreadsheetField(input)).toBe(expected);
    expect(escapeSpreadsheetField('plain')).toBe('"plain"');
  });

  it('sanitizes filenames by removing unsafe characters', () => {
    expect(sanitizeForFilename('My Car • 2025')).toBe('My_Car_2025');
    expect(sanitizeForFilename('__leading--trailing__')).toBe('leading--trailing');
  });
});
