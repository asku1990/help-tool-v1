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

    const tireSets = await prisma.tireSet.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { createdAt: 'desc' },
      include: {
        changeLogs: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    return ok({ tireSets });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/tires failed', { error });
    return serverError();
  }
}

const CreateTireSetSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['SUMMER', 'WINTER', 'ALL_SEASON']),
  status: z.enum(['ACTIVE', 'STORED', 'RETIRED']).optional(),
  purchaseDate: z.string().optional(),
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

    const parsed = CreateTireSetSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { name, type, status, purchaseDate, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const vehicle = access.vehicle;

    // If creating this tire as ACTIVE, set all other non-RETIRED tires to STORED
    if (status === 'ACTIVE') {
      await prisma.tireSet.updateMany({
        where: {
          vehicleId: vehicle.id,
          status: { not: 'RETIRED' },
        },
        data: { status: 'STORED' },
      });
    }

    const createdTireSet = await prisma.tireSet.create({
      data: {
        vehicleId: vehicle.id,
        name,
        type,
        status: status ?? 'STORED',
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        notes: notes || undefined,
      },
      select: { id: true },
    });

    return created({ id: createdTireSet.id });
  } catch (error) {
    logger.error('POST /api/vehicles/[vehicleId]/tires failed', { error });
    return serverError();
  }
}
