/**
 * Parses a string to number, handling comma decimal separators.
 */
export function toNum(v?: string): number | undefined {
  if (!v) return undefined;
  const num = Number(v.replace(',', '.'));
  return Number.isFinite(num) ? num : undefined;
}
