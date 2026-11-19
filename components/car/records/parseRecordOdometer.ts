// Blank means clear; undefined means invalid and must never be sent as null.
export function parseRecordOdometer(value: string): number | null | undefined {
  if (value === '') return null;
  if (!/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return undefined;
  const odometer = Number(value);
  // Prisma Int is a signed 32-bit integer in PostgreSQL.
  return Number.isInteger(odometer) && odometer >= -2147483648 && odometer <= 2147483647
    ? odometer
    : undefined;
}
