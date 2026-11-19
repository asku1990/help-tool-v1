import { describe, expect, it } from 'vitest';
import { calculateOilConsumption } from '..';

describe('calculateOilConsumption', () => {
  const date = new Date('2024-02-01');
  const topUp = { date, odometerKm: 15000, liters: 1 };

  it('counts earlier top-ups and only lower or unknown odometers at the same timestamp', () => {
    const history = [
      { date: new Date('2024-01-31'), odometerKm: 16000, liters: 0.5 },
      { date, odometerKm: 14000, liters: 0.25 },
      { date, odometerKm: null, liters: 0.25 },
      { date, odometerKm: 15000, liters: 5 },
      { date, odometerKm: 16000, liters: 5 },
      { date, odometerKm: 14500, liters: null },
    ];
    expect(calculateOilConsumption(topUp, 10000, history)).toBe(4);
  });

  it('returns unavailable when there is no positive distance or no oil consumed', () => {
    expect(calculateOilConsumption(topUp, 15000, [])).toBeNull();
    expect(calculateOilConsumption({ ...topUp, liters: 0 }, 10000, [])).toBeNull();
  });
});
