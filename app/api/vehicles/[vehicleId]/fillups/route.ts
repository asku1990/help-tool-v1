import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';

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
    if (!session?.user?.email) {
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

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

    const items = await prisma.fuelFillUp.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { date: 'desc' },
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
      // Compute segments in a pagination-safe way by backfilling older records up to previous full
      const oldestFullInPage = [...pageItems]
        .filter(f => f.isFull)
        .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

      let olderChunk: typeof pageItems = [];
      if (oldestFullInPage) {
        olderChunk = await prisma.fuelFillUp.findMany({
          where: { vehicleId: vehicle.id, date: { lte: oldestFullInPage.date } },
          orderBy: { date: 'desc' },
          take: 200,
        });
      }

      const combinedMap = new Map<string, (typeof pageItems)[number]>();
      for (const it of [...pageItems, ...olderChunk]) combinedMap.set(it.id, it);
      const combined = Array.from(combinedMap.values());
      const asc = combined.sort((a, b) => a.date.getTime() - b.date.getTime());

      type Seg = {
        distanceKm: number;
        litersUsed: number;
        lPer100: number;
        fuelCost: number;
        costPer100: number;
      };

      const segmentByFullId = new Map<string, Seg & { prevLPer100?: number }>();
      const segmentsLinear: Array<{ fullId: string; lPer100: number }> = [];
      let lastFullIndex = -1;
      for (let i = 0; i < asc.length; i++) {
        if (!asc[i].isFull) continue;
        if (lastFullIndex >= 0) {
          const prev = asc[lastFullIndex];
          const curr = asc[i];
          const distanceKm = curr.odometerKm - prev.odometerKm;
          if (distanceKm > 0) {
            const slice = asc.slice(lastFullIndex + 1, i + 1);
            const litersUsed = slice.reduce((s, f) => s + decimalToNumber(f.liters), 0);
            const fuelCost = slice.reduce((s, f) => s + decimalToNumber(f.totalCost), 0);
            const lPer100 = (litersUsed / distanceKm) * 100;
            const costPer100 = (fuelCost / distanceKm) * 100;
            segmentByFullId.set(curr.id, { distanceKm, litersUsed, lPer100, fuelCost, costPer100 });
            segmentsLinear.push({ fullId: curr.id, lPer100 });
          }
        }
        lastFullIndex = i;
      }

      for (let i = 0; i < segmentsLinear.length; i++) {
        const curr = segmentsLinear[i];
        const prev = segmentsLinear[i - 1];
        if (!prev) continue;
        const existing = segmentByFullId.get(curr.fullId);
        if (existing) {
          segmentByFullId.set(curr.fullId, { ...existing, prevLPer100: prev.lPer100 });
        }
      }

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
    if (!session?.user?.email) {
      return unauthorized();
    }

    const parsed = CreateFillUpSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { date, odometerKm, liters, pricePerLiter, totalCost, isFull, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

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
