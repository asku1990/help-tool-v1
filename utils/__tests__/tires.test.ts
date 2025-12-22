import { formatDuration, calculateTireUsage } from '@/utils/tires';
import type { TireSetDto, TireChangeLogDto } from '@/queries/tires';

describe('formatDuration', () => {
  it('returns "0 days" for zero or negative values', () => {
    expect(formatDuration(0)).toBe('0 days');
    expect(formatDuration(-5)).toBe('0 days');
  });

  it('returns singular "day" for 1 day', () => {
    expect(formatDuration(1)).toBe('1 day');
  });

  it('returns plural "days" for 2-59 days', () => {
    expect(formatDuration(2)).toBe('2 days');
    expect(formatDuration(45)).toBe('45 days');
    expect(formatDuration(59)).toBe('59 days');
  });

  it('returns months and days format for 60-364 days', () => {
    expect(formatDuration(60)).toBe('2m');
    expect(formatDuration(65)).toBe('2m 5d');
    expect(formatDuration(90)).toBe('3m');
    expect(formatDuration(100)).toBe('3m 10d');
    expect(formatDuration(364)).toBe('12m 4d');
  });

  it('returns years and months format for 365+ days', () => {
    expect(formatDuration(365)).toBe('1y');
    expect(formatDuration(395)).toBe('1y 1m');
    expect(formatDuration(730)).toBe('2y');
    expect(formatDuration(800)).toBe('2y 2m');
  });
});

describe('calculateTireUsage', () => {
  const makeTireSet = (
    id: string,
    name: string,
    status: 'ACTIVE' | 'STORED' | 'RETIRED' = 'STORED'
  ): TireSetDto => ({
    id,
    vehicleId: 'vehicle-1',
    name,
    type: 'SUMMER',
    status,
    totalKm: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  });

  const makeChangeLog = (
    tireSetId: string,
    date: string,
    odometerKm: number
  ): TireChangeLogDto => ({
    id: `log-${tireSetId}-${date}`,
    vehicleId: 'vehicle-1',
    tireSetId,
    date,
    odometerKm,
  });

  it('returns empty stats for tire sets with no history', () => {
    const tireSets = [makeTireSet('tire-1', 'Summer Tires')];
    const history: TireChangeLogDto[] = [];

    const result = calculateTireUsage(tireSets, history);
    const stats = result.get('tire-1');

    expect(stats).toBeDefined();
    expect(stats?.totalKm).toBe(0);
    expect(stats?.totalDays).toBe(0);
    expect(stats?.lastMountedDate).toBeNull();
  });

  it('calculates usage between two tire changes correctly', () => {
    const tireSets = [
      makeTireSet('tire-1', 'Summer Tires'),
      makeTireSet('tire-2', 'Winter Tires', 'ACTIVE'),
    ];
    const history = [
      makeChangeLog('tire-1', '2024-01-01', 10000),
      makeChangeLog('tire-2', '2024-04-01', 15000), // 91 days later (Jan 31 + Feb 29 + Mar 31), 5000 km
    ];

    const result = calculateTireUsage(tireSets, history);

    const summerStats = result.get('tire-1');
    expect(summerStats?.totalKm).toBe(5000);
    expect(summerStats?.totalDays).toBe(91); // 2024 is a leap year
    expect(summerStats?.lastUnmountedDate).toBe('2024-04-01');
  });

  it('calculates cumulative usage across multiple mounts', () => {
    const tireSets = [
      makeTireSet('tire-1', 'Summer Tires', 'ACTIVE'),
      makeTireSet('tire-2', 'Winter Tires'),
    ];
    const history = [
      makeChangeLog('tire-1', '2024-01-01', 10000),
      makeChangeLog('tire-2', '2024-04-01', 15000), // tire-1: 5000 km, 91 days (leap year)
      makeChangeLog('tire-1', '2024-10-01', 20000), // tire-2: 5000 km, 183 days
      // tire-1 is active from 2024-10-01 at 20000 km
    ];

    const currentDate = new Date('2024-12-01'); // 61 days from last change
    const currentOdometer = 25000; // 5000 km since last change

    const result = calculateTireUsage(tireSets, history, currentOdometer, currentDate);

    const summerStats = result.get('tire-1');
    // First mount: 5000 km, 91 days (Jan 1 to Apr 1 in leap year)
    // Second mount (current): 5000 km, 61 days
    expect(summerStats?.totalKm).toBe(10000);
    expect(summerStats?.totalDays).toBe(91 + 61);

    const winterStats = result.get('tire-2');
    expect(winterStats?.totalKm).toBe(5000);
    expect(winterStats?.totalDays).toBe(183);
  });

  it('handles currently active tire with current odometer', () => {
    const tireSets = [makeTireSet('tire-1', 'Summer Tires', 'ACTIVE')];
    const history = [makeChangeLog('tire-1', '2024-06-01', 50000)];

    const currentDate = new Date('2024-09-01'); // 92 days later
    const currentOdometer = 55000; // 5000 km driven

    const result = calculateTireUsage(tireSets, history, currentOdometer, currentDate);

    const stats = result.get('tire-1');
    expect(stats?.totalKm).toBe(5000);
    expect(stats?.totalDays).toBe(92);
    expect(stats?.isCurrentlyActive).toBe(true);
  });

  it('ignores tire sets not in the provided list', () => {
    const tireSets = [makeTireSet('tire-1', 'Summer Tires')];
    const history = [
      makeChangeLog('tire-1', '2024-01-01', 10000),
      makeChangeLog('tire-unknown', '2024-04-01', 15000),
    ];

    const result = calculateTireUsage(tireSets, history);

    expect(result.has('tire-1')).toBe(true);
    expect(result.has('tire-unknown')).toBe(false);
  });
});
