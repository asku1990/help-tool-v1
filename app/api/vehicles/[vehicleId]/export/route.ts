import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { sanitizeForFilename, serializeVehicleSpreadsheet } from './csv';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
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
      return new Response('Unauthorized', { status: 401 });
    }

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) {
      return new Response('Not found', { status: 404 });
    }
    const vehicle = access.vehicle;

    // Fetch all data in parallel
    const [fillUps, expenses, tireSets, changeLogs] = await Promise.all([
      prisma.fuelFillUp.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
        select: {
          id: true,
          date: true,
          odometerKm: true,
          liters: true,
          pricePerLiter: true,
          totalCost: true,
          isFull: true,
          notes: true,
        },
      }),
      prisma.expense.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
        select: {
          id: true,
          date: true,
          odometerKm: true,
          amount: true,
          category: true,
          vendor: true,
          liters: true,
          oilConsumption: true,
          notes: true,
        },
      }),
      prisma.tireSet.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          totalKm: true,
          purchaseDate: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.tireChangeLog.findMany({
        where: { vehicleId: vehicle.id },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          tireSetId: true,
          date: true,
          odometerKm: true,
          odometerConfirmed: true,
          notes: true,
          createdAt: true,
        },
      }),
    ]);

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const namePart = sanitizeForFilename(vehicle.name || vehicle.id);

    const csv = serializeVehicleSpreadsheet({ vehicle, fillUps, expenses, tireSets, changeLogs });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="spreadsheet_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
