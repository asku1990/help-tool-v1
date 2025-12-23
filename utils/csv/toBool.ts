/**
 * Parses a string to boolean. Accepts: 1, true, yes -> true; 0, false, no -> false.
 */
export function toBool(v?: string): boolean {
  if (!v) return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes';
}
