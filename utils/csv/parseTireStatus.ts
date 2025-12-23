import type { TireStatus } from '@/queries/tires';

/**
 * Parses a tire status string to TireStatus enum value.
 */
export function parseTireStatus(value: string): TireStatus | undefined {
  const normalized = value.toUpperCase().trim();
  if (normalized === 'ACTIVE') return 'ACTIVE';
  if (normalized === 'STORED') return 'STORED';
  if (normalized === 'RETIRED') return 'RETIRED';
  return undefined;
}
