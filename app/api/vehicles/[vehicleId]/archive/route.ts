import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';

export async function PUT(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const limit = checkRateLimit(rateLimitKey(req));
    if (!limit.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(limit.retryAfterMs),
      });
    const userId = await getSessionUserId(await auth());
    if (!userId) return unauthorized();
    const { vehicleId } = await context.params;
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'admin')) return notFound();
    const body = z.object({ archived: z.boolean() }).safeParse(await req.json().catch(() => null));
    if (!body.success) return badRequest('VALIDATION_ERROR', 'Expected an archived flag');
    const { archived } = body.data;
    await prisma.vehicle.updateMany({
      where: {
        id: vehicleId,
        access: { some: { userId, role: 'OWNER' } },
        archivedAtUtc: archived ? null : { not: null },
      },
      data: { archivedAtUtc: archived ? new Date() : null },
    });
    return ok({ id: vehicleId });
  } catch (error) {
    logger.error('PUT vehicle archive failed', { error });
    return serverError();
  }
}
