export function decimalToNumber(value: unknown): number {
  const maybeObj = value as { toNumber?: () => number } | null | undefined;
  if (maybeObj && typeof maybeObj === 'object' && typeof maybeObj.toNumber === 'function') {
    return maybeObj.toNumber();
  }
  if (typeof value === 'string') return parseFloat(value);
  if (typeof value === 'number') return value;
  return NaN;
}

export function mapDecimalsDeep<T>(input: T): T {
  if (input === null || input === undefined) return input;
  if (Array.isArray(input)) {
    return (input as unknown[]).map(mapDecimalsDeep) as unknown as T;
  }
  if (typeof input === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const maybeObj = value as { toNumber?: () => number } | null | undefined;
      if (maybeObj && typeof maybeObj === 'object' && typeof maybeObj.toNumber === 'function') {
        output[key] = decimalToNumber(maybeObj);
      } else {
        output[key] = mapDecimalsDeep(value as unknown);
      }
    }
    return output as T;
  }
  return input as unknown as T;
}
