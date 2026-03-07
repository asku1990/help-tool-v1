import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { ok, unauthorized, notFound, serverError } from '@/lib/api/response';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ vehicleId: string }> }
) {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed) {
      return new Response('Rate limit exceeded', {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
    }

    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) {
      return unauthorized();
    }

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'admin')) {
      return notFound('Vehicle not found');
    }

    // Delete all data for this vehicle in a transaction
    // Order matters due to foreign key constraints
    const result = await prisma.$transaction(async tx => {
      // Delete tire change logs first (references tire sets)
      const deletedChangeLogs = await tx.tireChangeLog.deleteMany({
        where: { vehicleId: access.vehicle.id },
      });

      // Delete tire sets
      const deletedTireSets = await tx.tireSet.deleteMany({
        where: { vehicleId: access.vehicle.id },
      });

      // Delete expenses
      const deletedExpenses = await tx.expense.deleteMany({
        where: { vehicleId: access.vehicle.id },
      });

      // Delete fill-ups
      const deletedFillUps = await tx.fuelFillUp.deleteMany({
        where: { vehicleId: access.vehicle.id },
      });

      return {
        fillUps: deletedFillUps.count,
        expenses: deletedExpenses.count,
        tireSets: deletedTireSets.count,
        changeLogs: deletedChangeLogs.count,
      };
    });

    return ok({
      message: 'Vehicle data cleared',
      deleted: result,
    });
  } catch (error) {
    logger.error('DELETE /api/vehicles/[vehicleId]/clear failed', { error });
    return serverError();
  }
}
