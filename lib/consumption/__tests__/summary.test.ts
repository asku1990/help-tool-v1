import { describe, expect, it } from 'vitest';
import { computeVehicleSummary } from '../summary';
import type { ConsumptionFillUp } from '../segments';

describe('vehicle summary', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it.each([
    {
      period: 'winter month rollover',
      previous: '2026-10-31T23:59:59.999+02:00',
      current: '2026-11-01T00:00:00+02:00',
      now: '2026-11-01T00:30:00+02:00',
    },
    {
      period: 'summer month rollover',
      previous: '2026-06-30T23:59:59.999+03:00',
      current: '2026-07-01T00:00:00+03:00',
      now: '2026-07-01T00:30:00+03:00',
    },
    {
      period: 'year rollover',
      previous: '2026-12-31T23:59:59.999+02:00',
      current: '2027-01-01T00:00:00+02:00',
      now: '2027-01-01T00:30:00+02:00',
    },
  ])('uses the Helsinki calendar at $period', ({ previous, current, now: timestamp }) => {
    const fillUps: ConsumptionFillUp[] = [
      {
        id: 'previous',
        date: previous,
        odometerKm: 100,
        liters: 5,
        totalCost: 10,
        isFull: false,
      },
      {
        id: 'current',
        date: current,
        odometerKm: 200,
        liters: 10,
        totalCost: 20,
        isFull: false,
      },
    ];
    const expenses = [
      { date: previous, category: 'PARKING', amount: 5 },
      { date: current, category: 'PARKING', amount: 7 },
    ];
    const summary = computeVehicleSummary(fillUps, expenses, new Date(timestamp));
    expect(summary.spendMTD).toBe(27);
    expect(summary.spend30d).toBe(42);
    expect(summary.breakdown90d.map(item => item.amount)).toEqual([30, 0, 12]);
  });

  it('includes history beyond the default list page in lifetime and period totals', () => {
    const fillUps: ConsumptionFillUp[] = Array.from({ length: 61 }, (_, i) => ({
      id: String(i),
      date: '2026-11-01T12:00:00Z',
      odometerKm: i * 100,
      liters: 5,
      totalCost: 10,
      isFull: true,
    })).reverse();
    const expenses = Array.from({ length: 60 }, () => ({
      date: '2026-11-02T12:00:00Z',
      category: 'MAINTENANCE',
      amount: 2,
    }));
    const summary = computeVehicleSummary(fillUps, expenses, now);
    expect(summary.segments).toHaveLength(60);
    expect(summary.costPerKmLifetime).toBeCloseTo(720 / 6000);
    expect(summary.costPerKm90d).toBeCloseTo(720 / 6000);
    expect(summary.spendMTD).toBe(730);
    expect(summary.spend30d).toBe(730);
    expect(summary.breakdown90d).toEqual([
      { label: 'Fuel', amount: 610 },
      { label: 'Maintenance', amount: 120 },
      { label: 'Other', amount: 0 },
    ]);
  });

  it('applies independent period filters without truncating lifetime history', () => {
    const fillUps: ConsumptionFillUp[] = [
      {
        id: 'a',
        date: '2025-01-01',
        odometerKm: 0,
        liters: 5,
        totalCost: 10,
        isFull: true,
      },
      {
        id: 'b',
        date: '2025-01-02',
        odometerKm: 100,
        liters: 5,
        totalCost: 10,
        isFull: true,
      },
      {
        id: 'c',
        date: '2026-11-01',
        odometerKm: 200,
        liters: 5,
        totalCost: 10,
        isFull: true,
      },
    ];
    const summary = computeVehicleSummary(
      fillUps,
      [
        { date: '2025-01-01', category: 'INSURANCE', amount: 20 },
        { date: '2026-10-01', category: 'MAINTENANCE', amount: 30 },
        { date: '2026-11-01', category: 'PARKING', amount: 2 },
      ],
      now
    );
    expect(summary.costPerKmLifetime).toBeCloseTo(72 / 200);
    expect(summary.costPerKm90d).toBeCloseTo(42 / 100);
    expect(summary.spendMTD).toBe(12);
    expect(summary.spend30d).toBe(12);
    expect(summary.breakdown90d.map(b => b.amount)).toEqual([10, 30, 2]);
  });

  it('serializes undefined consumption as null rather than a misleading zero', () => {
    const summary = computeVehicleSummary([], [], now);
    expect(summary.costPerKmLifetime).toBeNull();
    expect(summary.costPerKm90d).toBeNull();
    expect(summary.spendMTD).toBe(0);
    expect(summary.spend30d).toBe(0);
    expect(summary.segments).toEqual([]);
  });
});
