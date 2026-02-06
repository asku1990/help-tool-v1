import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
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
      orderBy: { date: 'desc' },
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
  date: z.string().min(1),
  odometerKm: z.number().int(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
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

    // Find the currently active tire set and its last change log
    const activeTireSet = await prisma.tireSet.findFirst({
      where: { vehicleId: vehicle.id, status: 'ACTIVE' },
      include: {
        changeLogs: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    // Calculate km driven on the previously active tire and update its totalKm
    if (activeTireSet && activeTireSet.changeLogs.length > 0) {
      const lastMountOdometer = activeTireSet.changeLogs[0].odometerKm;
      const kmDriven = odometerKm - lastMountOdometer;
      if (kmDriven > 0) {
        await prisma.tireSet.update({
          where: { id: activeTireSet.id },
          data: { totalKm: { increment: kmDriven } },
        });
      }
    }

    const log = await prisma.tireChangeLog.create({
      data: {
        vehicleId: vehicle.id,
        tireSetId,
        date: new Date(date),
        odometerKm,
        notes: notes || undefined,
      },
      select: { id: true },
    });

    // Update tire set statuses: mounted set becomes ACTIVE, all others (except RETIRED) become STORED
    await prisma.tireSet.updateMany({
      where: {
        vehicleId: vehicle.id,
        id: { not: tireSetId },
        status: { not: 'RETIRED' },
      },
      data: { status: 'STORED' },
    });
    await prisma.tireSet.update({
      where: { id: tireSetId },
      data: { status: 'ACTIVE' },
    });

    return created({ id: log.id });
  } catch (error) {
    logger.error('POST /api/vehicles/[vehicleId]/tires/change-log failed', { error });
    return serverError();
  }
}
