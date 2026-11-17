export type ConsumptionFillUp = {
  id: string;
  date: string;
  odometerKm: number;
  liters: number;
  totalCost: number;
  isFull: boolean;
};

export type ConsumptionSegment = {
  fullId: string;
  date: string;
  distanceKm: number;
  litersUsed: number;
  lPer100: number;
  fuelCost: number;
  costPer100: number;
  prevLPer100?: number;
};

export function buildConsumptionSegments(fillUps: ConsumptionFillUp[]): ConsumptionSegment[] {
  const asc = [...fillUps].sort(
    (a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime() ||
      a.odometerKm - b.odometerKm ||
      a.id.localeCompare(b.id)
  );
  const segments: ConsumptionSegment[] = [];
  let previousFull: ConsumptionFillUp | undefined;
  let litersUsed = 0;
  let fuelCost = 0;

  for (const fillUp of asc) {
    if (previousFull) {
      litersUsed += fillUp.liters;
      fuelCost += fillUp.totalCost;
    }
    if (!fillUp.isFull) continue;
    if (previousFull) {
      const distanceKm = fillUp.odometerKm - previousFull.odometerKm;
      if (distanceKm > 0) {
        segments.push({
          fullId: fillUp.id,
          date: fillUp.date,
          distanceKm,
          litersUsed,
          lPer100: (litersUsed / distanceKm) * 100,
          fuelCost,
          costPer100: (fuelCost / distanceKm) * 100,
          prevLPer100: segments[segments.length - 1]?.lPer100,
        });
      }
    }
    previousFull = fillUp;
    litersUsed = 0;
    fuelCost = 0;
  }
  return segments;
}

export function consumptionPer100(
  segments: ReadonlyArray<{ distanceKm: number; litersUsed: number }>
): number {
  const distance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  return distance > 0
    ? (segments.reduce((sum, segment) => sum + segment.litersUsed, 0) / distance) * 100
    : NaN;
}

export function fuelCostPer100(
  segments: ReadonlyArray<{ distanceKm: number; fuelCost: number }>
): number {
  const distance = segments.reduce((sum, segment) => sum + segment.distanceKm, 0);
  return distance > 0
    ? (segments.reduce((sum, segment) => sum + segment.fuelCost, 0) / distance) * 100
    : NaN;
}
