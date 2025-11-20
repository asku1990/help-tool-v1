import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

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
    if (!session?.user?.email) {
      return unauthorized();
    }

    const parsed = LogTireChangeSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { tireSetId, date, odometerKm, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

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

    // Update tire set statuses: mounted set becomes ACTIVE, all others become STORED
    await prisma.tireSet.updateMany({
      where: { vehicleId: vehicle.id },
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
