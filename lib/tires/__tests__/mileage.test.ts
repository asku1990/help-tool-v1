import { calculateTireMileage } from '../mileage';

it('keeps confirmed mileage, gaps, and the fill-up estimate separate', () => {
  const history = [
    { tireSetId: 'summer', date: '2026-04-01', odometerKm: 0, odometerConfirmed: true },
    { tireSetId: 'winter', date: '2026-10-01', odometerKm: 5000, odometerConfirmed: true },
    { tireSetId: 'summer', date: '2027-04-01', odometerKm: 7000, odometerConfirmed: false },
    { tireSetId: 'winter', date: '2027-10-01', odometerKm: 9000, odometerConfirmed: true },
  ];
  const fillUp = { date: '2027-10-16', odometerKm: 10200 };
  const result = calculateTireMileage(history, 'winter', fillUp);
  expect(result.bySet.get('summer')).toMatchObject({ confirmedKm: 5000, untrackedStints: 1 });
  expect(result.bySet.get('winter')).toMatchObject({ confirmedKm: null, untrackedStints: 1 });
  expect(result.currentEstimate).toEqual({ km: 1200, date: fillUp.date });

  const corrected = history.map((change, i) =>
    i === 2 ? { ...change, odometerKm: 7500, odometerConfirmed: true } : change
  );
  expect(calculateTireMileage(corrected, 'winter', fillUp).bySet.get('summer')).toMatchObject({
    confirmedKm: 6500,
    untrackedStints: 0,
  });
});

it('does not invent mileage for missing readings, a mismatched mount, or a stale fill-up', () => {
  const history = [
    { tireSetId: 'a', date: '2026-04-01', odometerKm: 5000, odometerConfirmed: true },
    { tireSetId: 'b', date: '2026-10-01', odometerKm: null, odometerConfirmed: false },
  ];
  expect(
    calculateTireMileage(history, 'b', { date: '2026-10-02', odometerKm: 9000 })
  ).toMatchObject({
    currentEstimate: null,
  });
  expect(
    calculateTireMileage(history.slice(0, 1), 'b', { date: '2026-10-02', odometerKm: 9000 })
      .currentEstimate
  ).toBeNull();
  expect(
    calculateTireMileage(history.slice(0, 1), 'a', { date: '2026-04-01', odometerKm: 9000 })
      .currentEstimate
  ).toBeNull();
});
