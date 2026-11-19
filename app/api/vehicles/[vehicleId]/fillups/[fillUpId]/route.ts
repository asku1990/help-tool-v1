import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getSessionUserId, canAccessVehicle } from '@/lib/api/vehicle-access';
import { checkRateLimit, rateLimitHeaders, recordEditRateLimitKey } from '@/lib/api/rate-limit';

const UpdateSchema = z.object({
  date: z.string().min(1, 'Date cannot be empty').optional(),
  odometerKm: z.number().int().optional(),
  liters: z.number().optional(),
  pricePerLiter: z.number().optional(),
  isFull: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ vehicleId: string; fillUpId: string }> }
) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();
    const { vehicleId, fillUpId } = await context.params;
    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());

    const canWrite = await canAccessVehicle(vehicleId, userId, 'write');
    if (!canWrite) return notFound();

    const rateLimit = checkRateLimit(recordEditRateLimitKey(userId, vehicleId));
    if (!rateLimit.allowed) {
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rateLimit.retryAfterMs),
      });
    }

    const { date, ...fields } = parsed.data;
    const where = { id: fillUpId, vehicleId };
    const data = { ...fields, date: date ? new Date(date) : undefined };
    const select = { id: true } as const;
    const updated =
      fields.liters !== undefined || fields.pricePerLiter !== undefined
        ? await prisma.$transaction(async tx => {
            // The first update locks the row and returns the persisted decimal values.
            const { liters, pricePerLiter } = await tx.fuelFillUp.update({
              where,
              data,
              select: { liters: true, pricePerLiter: true },
            });
            return tx.fuelFillUp.update({
              where,
              data: { totalCost: liters.mul(pricePerLiter) },
              select,
            });
          })
        : await prisma.fuelFillUp.update({ where, data, select });
    return ok({ id: updated.id });
  } catch (error) {
    let code: string | undefined;
    if (error && typeof error === 'object' && 'code' in error) {
      code = (error as { code?: string }).code;
    }
    if (code === 'P2025') {
      return notFound();
    }
    logger.error('PATCH /api/vehicles/[vehicleId]/fillups/[fillUpId] failed', { error });
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ vehicleId: string; fillUpId: string }> }
) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();
    const { vehicleId, fillUpId } = await context.params;
    const canWrite = await canAccessVehicle(vehicleId, userId, 'write');
    if (!canWrite) return notFound();
    await prisma.fuelFillUp.delete({ where: { id: fillUpId, vehicleId } });
    return ok({ id: fillUpId });
  } catch (error) {
    let code: string | undefined;
    if (error && typeof error === 'object' && 'code' in error) {
      code = (error as { code?: string }).code;
    }
    if (code === 'P2025') {
      return notFound();
    }
    logger.error('DELETE /api/vehicles/[vehicleId]/fillups/[fillUpId] failed', { error });
    return serverError();
  }
}
