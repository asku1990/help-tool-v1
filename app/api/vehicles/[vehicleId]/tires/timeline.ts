import type { Prisma } from '@/generated/prisma';
import { badRequest } from '@/lib/api/response';

export const newestChangeFirst: Prisma.TireChangeLogOrderByWithRelationInput[] = [
  { date: 'desc' },
  { createdAt: 'desc' },
  { id: 'desc' },
];

export class OdometerOrderError extends Error {}

export function odometerOrderResponse() {
  return badRequest(
    'ODOMETER_OUT_OF_ORDER',
    'This reading must be between the surrounding confirmed tire change readings.'
  );
}

export async function latestTireChange(tx: Prisma.TransactionClient, vehicleId: string) {
  return tx.tireChangeLog.findFirst({
    where: { vehicleId },
    orderBy: newestChangeFirst,
    select: { tireSetId: true },
  });
}

export async function reconcileTireTimeline(
  tx: Prisma.TransactionClient,
  vehicleId: string,
  previousSetId: string | undefined,
  changedId?: string
) {
  const changes = await tx.tireChangeLog.findMany({
    where: { vehicleId },
    orderBy: newestChangeFirst,
    select: { id: true, tireSetId: true, odometerKm: true, odometerConfirmed: true },
  });

  const index = changes.findIndex(change => change.id === changedId);
  const change = changes[index];
  if (change?.odometerConfirmed && change.odometerKm !== null) {
    const confirmed = (row: (typeof changes)[number]) =>
      row.odometerConfirmed && row.odometerKm !== null;
    const newer = changes.slice(0, index).findLast(confirmed)?.odometerKm;
    const older = changes.slice(index + 1).find(confirmed)?.odometerKm;
    if (
      (older != null && change.odometerKm < older) ||
      (newer != null && change.odometerKm > newer)
    ) {
      throw new OdometerOrderError();
    }
  }

  const currentSetId = changes[0]?.tireSetId;
  if (currentSetId === previousSetId) return;
  await tx.tireSet.updateMany({
    where: { vehicleId, status: 'ACTIVE', ...(currentSetId && { id: { not: currentSetId } }) },
    data: { status: 'STORED' },
  });
  if (currentSetId) {
    await tx.tireSet.update({
      where: { vehicleId, id: currentSetId },
      data: { status: 'ACTIVE' },
    });
  }
}
