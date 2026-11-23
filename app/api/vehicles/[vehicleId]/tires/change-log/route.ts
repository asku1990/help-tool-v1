import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { rateLimitTireRequest } from '../rateLimitTireRequest';
import {
  latestTireChange,
  newestChangeFirst,
  OdometerOrderError,
  odometerOrderResponse,
  reconcileTireTimeline,
} from '../timeline';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const limited = rateLimitTireRequest(req);
    if (limited) return limited;
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) {
      return unauthorized();
    }

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) return notFound();
    const vehicle = access.vehicle;

    const history = await prisma.tireChangeLog.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: newestChangeFirst,
      include: {
        tireSet: true,
      },
    });

    return ok({ history });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/tires/change-log failed', { error });
    return serverError();
  }
}

const LogTireChangeSchema = z.object({
  tireSetId: z.string().uuid(),
  date: z.iso.date(),
  odometerKm: z.number().int().min(0).max(2_147_483_647).nullish(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const limited = rateLimitTireRequest(req);
    if (limited) return limited;
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) {
      return unauthorized();
    }

    const parsed = LogTireChangeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { tireSetId, date, odometerKm, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const vehicle = access.vehicle;

    // Verify tire set belongs to vehicle
    const tireSet = await prisma.tireSet.findFirst({
      where: { id: tireSetId, vehicleId: vehicle.id },
    });
    if (!tireSet) {
      return badRequest(
        'INVALID_TIRE_SET',
        'Tire set not found or does not belong to this vehicle'
      );
    }

    const log = await prisma.$transaction(
      async tx => {
        const previous = await latestTireChange(tx, vehicle.id);
        const entry = await tx.tireChangeLog.create({
          data: {
            vehicleId: vehicle.id,
            tireSetId,
            date: new Date(date),
            odometerKm: odometerKm ?? null,
            odometerConfirmed: odometerKm != null,
            notes: notes || undefined,
          },
          select: { id: true },
        });
        await reconcileTireTimeline(tx, vehicle.id, previous?.tireSetId, entry.id);
        return entry;
      },
      { isolationLevel: 'Serializable' }
    );

    return created({ id: log.id });
  } catch (error) {
    if (error instanceof OdometerOrderError) return odometerOrderResponse();
    logger.error('POST /api/vehicles/[vehicleId]/tires/change-log failed', { error });
    return serverError();
  }
}
