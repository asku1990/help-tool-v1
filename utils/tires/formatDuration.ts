/**
 * Formats a duration in days to a human-readable auto-format string.
 * - Less than 60 days: "45 days"
 * - Less than 12 months: "3m 5d"
 * - 12+ months: "2y 3m"
 */
export function formatDuration(totalDays: number): string {
  if (totalDays < 0) return '0 days';
  if (totalDays === 0) return '0 days';

  const years = Math.floor(totalDays / 365);
  const remainingAfterYears = totalDays % 365;
  const months = Math.floor(remainingAfterYears / 30);
  const days = remainingAfterYears % 30;

  // Less than 60 days: show as days only
  if (totalDays < 60) {
    return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
  }

  // Less than 12 months: show months and days
  if (years === 0) {
    if (days === 0) {
      return `${months}m`;
    }
    return `${months}m ${days}d`;
  }

  // 12+ months: show years and months
  if (months === 0) {
    return `${years}y`;
  }
  return `${years}y ${months}m`;
}
