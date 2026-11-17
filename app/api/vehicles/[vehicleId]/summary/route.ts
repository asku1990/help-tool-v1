import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { ok, unauthorized, notFound, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { logger } from '@/lib/logger';
import { computeVehicleSummary } from '@/lib/consumption';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed) {
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
    }
    const userId = await getSessionUserId(await auth());
    if (!userId) return unauthorized();
    const { vehicleId } = await context.params;
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) return notFound();

    // Summaries must cover history independently of the paginated record lists.
    const [fillUps, expenses] = await Promise.all([
      prisma.fuelFillUp.findMany({
        where: { vehicleId: access.vehicle.id },
        select: {
          id: true,
          date: true,
          odometerKm: true,
          liters: true,
          totalCost: true,
          isFull: true,
        },
      }),
      prisma.expense.findMany({
        where: { vehicleId: access.vehicle.id },
        select: { date: true, category: true, amount: true },
      }),
    ]);
    const summary = computeVehicleSummary(
      fillUps.map(f => ({
        ...f,
        date: f.date.toISOString(),
        liters: decimalToNumber(f.liters),
        totalCost: decimalToNumber(f.totalCost),
      })),
      expenses.map(e => ({
        ...e,
        date: e.date.toISOString(),
        amount: decimalToNumber(e.amount),
      }))
    );
    return ok(summary, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/summary failed', { error });
    return serverError();
  }
}
