type Reading = { date: string; odometerKm: number };

type Change = {
  tireSetId: string;
  date: string;
  odometerKm: number | null;
  odometerConfirmed: boolean;
  createdAt?: string;
  id?: string;
};

export type SetMileage = {
  confirmedKm: number | null;
  untrackedStints: number;
  lastUnmountedDate: string | null;
};

export type TireMileageEstimate = { km: number; date: string };

export function calculateTireMileage(
  history: readonly Change[],
  mountedSetId?: string,
  latestFillUp?: Reading
) {
  const ordered = [...history].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
      (a.id ?? '').localeCompare(b.id ?? '')
  );
  const bySet = new Map<string, SetMileage>();

  for (let i = 0; i < ordered.length - 1; i++) {
    const start = ordered[i];
    const end = ordered[i + 1];
    const totals = bySet.get(start.tireSetId) ?? {
      confirmedKm: null,
      untrackedStints: 0,
      lastUnmountedDate: null,
    };
    if (
      start.odometerConfirmed &&
      end.odometerConfirmed &&
      start.odometerKm !== null &&
      end.odometerKm !== null &&
      end.odometerKm >= start.odometerKm
    ) {
      totals.confirmedKm = (totals.confirmedKm ?? 0) + end.odometerKm - start.odometerKm;
    } else {
      totals.untrackedStints++;
    }
    totals.lastUnmountedDate = end.date;
    bySet.set(start.tireSetId, totals);
  }

  const lastChange = ordered.at(-1);
  const currentEstimate: TireMileageEstimate | null =
    lastChange &&
    lastChange.tireSetId === mountedSetId &&
    lastChange.odometerConfirmed &&
    lastChange.odometerKm !== null &&
    latestFillUp &&
    latestFillUp.date.slice(0, 10) > lastChange.date.slice(0, 10) &&
    latestFillUp.odometerKm >= lastChange.odometerKm
      ? { km: latestFillUp.odometerKm - lastChange.odometerKm, date: latestFillUp.date }
      : null;
  return { bySet, currentEstimate };
}
