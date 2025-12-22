import type { TireSetDto, TireChangeLogDto } from '@/queries/tires';

export type TireUsageStats = {
  tireSetId: string;
  totalKm: number;
  totalDays: number;
  lastMountedDate: string | null;
  lastUnmountedDate: string | null;
  isCurrentlyActive: boolean;
};

/**
 * Calculates usage statistics for each tire set based on change history.
 *
 * Logic:
 * - Sort all change logs by date (ascending)
 * - Each change log marks when a tire set was mounted
 * - The tire set remains active until the next change log (different tire set)
 * - For the currently active tire, calculate until today/currentOdometer
 */
export function calculateTireUsage(
  tireSets: TireSetDto[],
  history: TireChangeLogDto[],
  currentOdometer?: number,
  currentDate: Date = new Date()
): Map<string, TireUsageStats> {
  const usageMap = new Map<string, TireUsageStats>();

  // Initialize usage stats for all tire sets
  for (const set of tireSets) {
    usageMap.set(set.id, {
      tireSetId: set.id,
      totalKm: 0,
      totalDays: 0,
      lastMountedDate: null,
      lastUnmountedDate: null,
      isCurrentlyActive: set.status === 'ACTIVE',
    });
  }

  if (history.length === 0) {
    return usageMap;
  }

  // Sort history by date ascending (oldest first)
  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Process each change log entry
  for (let i = 0; i < sortedHistory.length; i++) {
    const current = sortedHistory[i];
    const next = sortedHistory[i + 1];
    const stats = usageMap.get(current.tireSetId);

    if (!stats) continue;

    // Update last mounted date
    if (!stats.lastMountedDate || new Date(current.date) > new Date(stats.lastMountedDate)) {
      stats.lastMountedDate = current.date;
    }

    if (next) {
      // This tire was active from current.date to next.date
      const startDate = new Date(current.date);
      const endDate = new Date(next.date);
      const daysActive = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Calculate km driven
      const kmDriven = next.odometerKm - current.odometerKm;

      if (daysActive > 0) {
        stats.totalDays += daysActive;
      }
      if (kmDriven > 0) {
        stats.totalKm += kmDriven;
      }

      // Update last unmounted date for this tire set
      stats.lastUnmountedDate = next.date;
    } else {
      // This is the last entry - tire is currently active (or was last used)
      const startDate = new Date(current.date);
      const endDate = currentDate;
      const daysActive = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysActive > 0) {
        stats.totalDays += daysActive;
      }

      // Calculate km from last mount to current odometer if available
      if (currentOdometer !== undefined && currentOdometer > current.odometerKm) {
        stats.totalKm += currentOdometer - current.odometerKm;
      }
    }
  }

  return usageMap;
}
