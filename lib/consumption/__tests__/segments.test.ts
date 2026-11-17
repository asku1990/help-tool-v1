import { describe, expect, it } from 'vitest';
import {
  buildConsumptionSegments,
  consumptionPer100,
  fuelCostPer100,
  type ConsumptionFillUp,
} from '../segments';

describe('fuel consumption', () => {
  const fillUps: ConsumptionFillUp[] = [
    {
      id: '5',
      date: '2026-11-17',
      odometerKm: 199468,
      liters: 8.55,
      totalCost: 11.54,
      isFull: true,
    },
    {
      id: '4',
      date: '2026-11-15',
      odometerKm: 199219,
      liters: 17.43,
      totalCost: 32.59,
      isFull: true,
    },
    {
      id: '3',
      date: '2026-11-13',
      odometerKm: 198736,
      liters: 13.9,
      totalCost: 32.66,
      isFull: true,
    },
    {
      id: '2',
      date: '2026-11-13',
      odometerKm: 198395,
      liters: 8.92,
      totalCost: 12.04,
      isFull: true,
    },
    {
      id: '1',
      date: '2026-11-10',
      odometerKm: 198209,
      liters: 10.46,
      totalCost: 14.12,
      isFull: true,
    },
  ];

  it('orders equal-date fill-ups by odometer without mutating input', () => {
    const before = [...fillUps];
    const segments = buildConsumptionSegments(fillUps);
    expect(segments.map(s => s.distanceKm)).toEqual([186, 341, 483, 249]);
    expect(segments.map(s => s.lPer100.toFixed(2))).toEqual(['4.80', '4.08', '3.61', '3.43']);
    expect(consumptionPer100(segments.slice(-3)).toFixed(2)).toBe('3.72');
    expect(fuelCostPer100(segments.slice(-3))).toBeCloseTo((76.79 / 1073) * 100);
    expect(fillUps).toEqual(before);
    expect(buildConsumptionSegments([...fillUps].reverse())).toEqual(segments);
    expect(segments[3].prevLPer100).toBe(segments[2].lPer100);
  });

  it('includes partial fills only between two full tanks', () => {
    const segments = buildConsumptionSegments([
      {
        ...fillUps[0],
        id: 'before',
        date: '2026-01-01',
        odometerKm: 0,
        liters: 10,
        isFull: false,
      },
      {
        ...fillUps[0],
        id: 'start',
        date: '2026-01-02',
        odometerKm: 100,
        liters: 20,
        totalCost: 30,
      },
      {
        ...fillUps[0],
        id: 'partial',
        date: '2026-01-03',
        odometerKm: 200,
        liters: 4,
        totalCost: 6,
        isFull: false,
      },
      {
        ...fillUps[0],
        id: 'end',
        date: '2026-01-04',
        odometerKm: 400,
        liters: 8,
        totalCost: 12,
      },
      {
        ...fillUps[0],
        id: 'after',
        date: '2026-01-05',
        odometerKm: 500,
        liters: 5,
        isFull: false,
      },
    ]);
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      fullId: 'end',
      distanceKm: 300,
      litersUsed: 12,
      fuelCost: 18,
      lPer100: 4,
      costPer100: 6,
    });
  });

  it('weights averages by distance rather than treating each trip equally', () => {
    const segments = [
      { distanceKm: 100, litersUsed: 10, fuelCost: 20 },
      { distanceKm: 900, litersUsed: 45, fuelCost: 90 },
    ];
    expect(consumptionPer100(segments)).toBe(5.5);
    expect(fuelCostPer100(segments)).toBe(11);
  });

  it('does not emit zero or negative distance segments', () => {
    const segments = buildConsumptionSegments([
      { ...fillUps[0], id: 'a', date: '2026-01-01', odometerKm: 200 },
      { ...fillUps[0], id: 'b', date: '2026-01-02', odometerKm: 200 },
      { ...fillUps[0], id: 'c', date: '2026-01-03', odometerKm: 100 },
    ]);
    expect(segments).toEqual([]);
  });

  it('handles missing baselines and empty history', () => {
    expect(buildConsumptionSegments([])).toEqual([]);
    expect(buildConsumptionSegments([fillUps[0]])).toEqual([]);
    expect(consumptionPer100([])).toBeNaN();
    expect(fuelCostPer100([])).toBeNaN();
  });
});
