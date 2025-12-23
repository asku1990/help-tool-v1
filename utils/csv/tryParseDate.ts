/**
 * Parses a date string in ISO (YYYY-MM-DD) or European (DD.MM.YYYY) format.
 * Returns ISO date string or undefined if invalid.
 */
export function tryParseDate(token: string): string | undefined {
  const t = token.trim();
  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  // European format: DD.MM.YYYY
  const m1 = t.match(/^([0-3]?\d)\.([0-1]?\d)\.(\d{4})$/);
  if (m1) {
    const d = Number(m1[1]);
    const mo = Number(m1[2]) - 1;
    const y = Number(m1[3]);
    const dt = new Date(Date.UTC(y, mo, d));
    return dt.toISOString().slice(0, 10);
  }
  return undefined;
}
