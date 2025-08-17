import { decimalToNumber, mapDecimalsDeep } from '@/lib/prisma/decimal';

describe('decimalToNumber', () => {
  it('returns number for number input', () => {
    expect(decimalToNumber(1.23)).toBe(1.23);
  });
  it('parses string to number', () => {
    expect(decimalToNumber('2.5')).toBeCloseTo(2.5);
  });
  it('calls toNumber when available', () => {
    const obj: { toNumber: () => number } = { toNumber: () => 3.14 };
    expect(decimalToNumber(obj)).toBeCloseTo(3.14);
  });
  it('returns NaN for unsupported', () => {
    expect(Number.isNaN(decimalToNumber({}))).toBe(true);
  });
});

describe('mapDecimalsDeep', () => {
  it('maps decimals in object properties; leaves array items as-is', () => {
    const input: unknown = {
      a: { toNumber: () => 1 },
      b: [{ toNumber: () => 2 }, 3, '4.5'],
    };
    const outUnknown = mapDecimalsDeep(
      input as { a: { toNumber: () => number }; b: unknown[] }
    ) as unknown;
    const out = outUnknown as { a: number; b: unknown[] };
    expect(out.a).toBe(1);
    expect(Array.isArray(out.b)).toBe(true);
    const first = out.b[0] as { toNumber: () => number };
    expect(typeof first).toBe('object');
    expect(typeof first.toNumber).toBe('function');
    expect(out.b[1]).toBe(3);
    expect(out.b[2]).toBe('4.5');
  });
  it('returns primitives unchanged', () => {
    expect(mapDecimalsDeep(null)).toBeNull();
    expect(mapDecimalsDeep(undefined)).toBeUndefined();
    expect(mapDecimalsDeep(5)).toBe(5);
  });
});
