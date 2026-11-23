import type { TireType } from '@/queries/tires';

export const tireTypeLabels: Record<TireType, string> = {
  SUMMER: 'Summer',
  WINTER: 'Winter',
  ALL_SEASON: 'All-season',
};

export const tireDateInput = (value: string) => value.slice(0, 10);
export const formatTireDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
