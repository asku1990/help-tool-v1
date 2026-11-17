import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';
import { buildConsumptionSegments } from '@/lib/consumption';

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
    const withSegmentsParam = url.searchParams.get('withSegments');
    const withSegments = withSegmentsParam === '1' || withSegmentsParam === 'true';

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'read')) return notFound();
    const vehicle = access.vehicle;

    const items = await prisma.fuelFillUp.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const pageItems = hasMore ? items.slice(0, -1) : items;

    let fillUps = pageItems.map(f => ({
      id: f.id,
      date: f.date.toISOString(),
      odometerKm: f.odometerKm,
      liters: decimalToNumber(f.liters),
      pricePerLiter: decimalToNumber(f.pricePerLiter),
      totalCost: decimalToNumber(f.totalCost),
      isFull: f.isFull,
      notes: f.notes ?? undefined,
    }));

    if (withSegments) {
      // Include complete older history for the baseline and previous consumption rate.
      const oldestFullInPage = [...pageItems]
        .filter(f => f.isFull)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

      let olderChunk: typeof pageItems = [];
      if (oldestFullInPage) {
        olderChunk = await prisma.fuelFillUp.findMany({
          where: { vehicleId: vehicle.id, date: { lte: oldestFullInPage.date } },
          orderBy: [{ date: 'desc' }, { odometerKm: 'desc' }],
        });
      }

      const combinedMap = new Map<string, (typeof pageItems)[number]>();
      for (const it of [...pageItems, ...olderChunk]) combinedMap.set(it.id, it);
      const segments = buildConsumptionSegments(
        Array.from(combinedMap.values()).map(f => ({
          ...f,
          date: f.date.toISOString(),
          liters: decimalToNumber(f.liters),
          totalCost: decimalToNumber(f.totalCost),
        }))
      );
      const segmentByFullId = new Map(segments.map(s => [s.fullId, s]));

      fillUps = fillUps.map(f => {
        if (!f.isFull) return f;
        const seg = segmentByFullId.get(f.id);
        if (!seg) return f;
        return {
          ...f,
          segment: {
            distanceKm: seg.distanceKm,
            litersUsed: seg.litersUsed,
            lPer100: seg.lPer100,
            fuelCost: seg.fuelCost,
            costPer100: seg.costPer100,
            prevLPer100: seg.prevLPer100,
          },
        } as typeof f & {
          segment: {
            distanceKm: number;
            litersUsed: number;
            lPer100: number;
            fuelCost: number;
            costPer100: number;
            prevLPer100?: number;
          };
        };
      });
    }

    return ok(
      { fillUps, nextCursor: hasMore ? fillUps[fillUps.length - 1]?.id : null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/fillups failed', { error });
    return serverError();
  }
}

const CreateFillUpSchema = z.object({
  date: z.string().min(1),
  odometerKm: z.number().int(),
  liters: z.number(),
  pricePerLiter: z.number(),
  totalCost: z.number(),
  isFull: z.boolean().optional(),
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

    const parsed = CreateFillUpSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { date, odometerKm, liters, pricePerLiter, totalCost, isFull, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const vehicle = access.vehicle;

    const createdFillUp = await prisma.fuelFillUp.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(date),
        odometerKm,
        liters,
        pricePerLiter,
        totalCost,
        isFull: !!isFull,
        notes: notes || undefined,
      },
      select: { id: true },
    });

    return created({ id: createdFillUp.id });
  } catch (error) {
    logger.error('POST /api/vehicles/[vehicleId]/fillups failed', { error });
    return serverError();
  }
}
