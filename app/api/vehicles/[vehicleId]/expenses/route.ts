import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    // Basic rate limiting per IP+path
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

    const url = new URL(req.url);
    const defaultLimit = Number(process.env.API_PAGE_DEFAULT_LIMIT || 50);
    const maxLimit = Number(process.env.API_PAGE_MAX_LIMIT || 100);
    const requested = parseInt(url.searchParams.get('limit') || String(defaultLimit), 10);
    const limit = Math.min(
      Math.max(Number.isFinite(requested) ? requested : defaultLimit, 1),
      maxLimit
    );
    const cursor = url.searchParams.get('cursor') || undefined;

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) return notFound();
    const vehicle = access.vehicle;

    const items = await prisma.expense.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const expenses = (hasMore ? items.slice(0, -1) : items).map(e => ({
      id: e.id,
      date: e.date.toISOString(),
      category: e.category,
      amount: decimalToNumber(e.amount),
      vendor: e.vendor ?? undefined,
      odometerKm: e.odometerKm ?? undefined,
      liters: e.liters != null ? decimalToNumber(e.liters) : undefined,
      oilConsumption: e.oilConsumption != null ? decimalToNumber(e.oilConsumption) : undefined,
      notes: e.notes ?? undefined,
    }));

    const agg = await prisma.expense.aggregate({
      where: { vehicleId: vehicle.id },
      _sum: { amount: true },
    });
    const expensesTotal = decimalToNumber(agg._sum.amount ?? 0);

    return ok(
      { expenses, expensesTotal, nextCursor: hasMore ? expenses[expenses.length - 1]?.id : null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/expenses failed', { error });
    return serverError();
  }
}

const CreateExpenseSchema = z.object({
  date: z.string().min(1),
  category: z.enum([
    'FUEL',
    'MAINTENANCE',
    'INSURANCE',
    'TAX',
    'PARKING',
    'TOLL',
    'OIL_CHANGE',
    'OIL_TOP_UP',
    'INSPECTION',
    'TIRES',
    'OTHER',
  ]),
  amount: z.number(),
  vendor: z.string().optional(),
  odometerKm: z.number().int().optional(),
  liters: z.number().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    // Basic rate limiting per IP+path
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

    const parsed = CreateExpenseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { date, category, amount, vendor, odometerKm, liters, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const vehicle = access.vehicle;

    // Calculate oilConsumption for OIL_TOP_UP expenses
    let oilConsumption: number | undefined;
    if (category === 'OIL_TOP_UP' && typeof odometerKm === 'number' && typeof liters === 'number') {
      // Find the last oil change
      const lastOilChange = await prisma.expense.findFirst({
        where: { vehicleId: vehicle.id, category: 'OIL_CHANGE' },
        orderBy: { date: 'desc' },
      });

      if (lastOilChange?.odometerKm !== null && lastOilChange?.odometerKm !== undefined) {
        // Get all top-ups since last oil change, up to and including this expense's date
        // Include same-day entries with lower odometer (earlier in the day)
        const expenseDate = new Date(date);
        const topUpsSince = await prisma.expense.findMany({
          where: {
            vehicleId: vehicle.id,
            category: 'OIL_TOP_UP',
            date: { gt: lastOilChange.date, lte: expenseDate },
          },
          select: { date: true, odometerKm: true, liters: true },
        });

        // Filter to include only entries before this one (by date, then by odometer for same day)
        const previousTopUps = topUpsSince.filter(e => {
          if (!e.odometerKm) return true; // Include if no odometer (can't compare)
          const entryDate = e.date.getTime();
          const currentDate = expenseDate.getTime();
          if (entryDate < currentDate) return true; // Earlier day - include
          if (entryDate === currentDate && e.odometerKm < odometerKm) return true; // Same day, lower odometer
          return false;
        });

        const previousTopUpLiters = previousTopUps.reduce(
          (sum, e) => sum + (e.liters ? decimalToNumber(e.liters) : 0),
          0
        );
        const totalLiters = previousTopUpLiters + liters;
        const distance = odometerKm - lastOilChange.odometerKm;

        if (distance > 0 && totalLiters > 0) {
          oilConsumption = (totalLiters / distance) * 10000; // L per 10,000 km
        }
      }
    }

    const createdExpense = await prisma.expense.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(date),
        category,
        amount,
        vendor: vendor || undefined,
        odometerKm: typeof odometerKm === 'number' ? odometerKm : undefined,
        liters: typeof liters === 'number' ? liters : undefined,
        oilConsumption,
        notes: notes || undefined,
      },
      select: { id: true },
    });

    return created({ id: createdExpense.id });
  } catch (error) {
    logger.error('POST /api/vehicles/[vehicleId]/expenses failed', { error });
    return serverError();
  }
}
