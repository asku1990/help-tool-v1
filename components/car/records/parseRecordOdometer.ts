// Blank means clear; undefined means invalid and must never be sent as null.
export function parseRecordOdometer(value: string): number | null | undefined {
  if (value === '') return null;
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return undefined;
  const odometer = Number(value);
  return Number.isSafeInteger(odometer) ? odometer : undefined;
}
