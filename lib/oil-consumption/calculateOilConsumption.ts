type TopUp = {
  date: Date;
  odometerKm: number;
  liters: number;
};

type HistoricalTopUp = {
  date: Date;
  odometerKm: number | null;
  liters: number | null;
};

/** Returns liters per 10,000 km, or null when no rate can be calculated. */
export function calculateOilConsumption(
  topUp: TopUp,
  oilChangeOdometerKm: number,
  topUpsSinceOilChange: readonly HistoricalTopUp[]
): number | null {
  const distance = topUp.odometerKm - oilChangeOdometerKm;
  if (distance <= 0) return null;

  const date = topUp.date.getTime();
  const previousLiters = topUpsSinceOilChange.reduce((total, previous) => {
    const previousDate = previous.date.getTime();
    const included =
      previousDate < date ||
      (previousDate === date && (!previous.odometerKm || previous.odometerKm < topUp.odometerKm));
    return included ? total + (previous.liters ?? 0) : total;
  }, 0);

  const totalLiters = previousLiters + topUp.liters;
  return totalLiters > 0 ? (totalLiters / distance) * 10000 : null;
}
