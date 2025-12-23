import type { TireType } from '@/queries/tires';

/**
 * Parses a tire type string to TireType enum value.
 */
export function parseTireType(value: string): TireType | undefined {
  const normalized = value.toUpperCase().trim();
  if (normalized === 'SUMMER') return 'SUMMER';
  if (normalized === 'WINTER') return 'WINTER';
  if (normalized === 'ALL_SEASON' || normalized === 'ALL-SEASON' || normalized === 'ALLSEASON')
    return 'ALL_SEASON';
  return undefined;
}
