import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';

function escapeCsvField(value: string): string {
  const mustQuote = /[";\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function sanitizeForFilename(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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
    if (!session?.user?.email) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true, name: true },
    });
    if (!vehicle) {
      return new Response('Not found', { status: 404 });
    }

    const fillUps = await prisma.fuelFillUp.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { date: 'desc' },
      select: {
        date: true,
        odometerKm: true,
        liters: true,
        pricePerLiter: true,
        totalCost: true,
        isFull: true,
        notes: true,
      },
    });

    const header = 'Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes';
    const lines = fillUps.map(f => {
      const date = f.date.toISOString().slice(0, 10);
      const odometer = f.odometerKm;
      const liters = decimalToNumber(f.liters).toFixed(2);
      const pricePerLiter = decimalToNumber(f.pricePerLiter).toFixed(3);
      const totalCost = decimalToNumber(f.totalCost).toFixed(2);
      const isFull = f.isFull ? '1' : '0';
      const notes = f.notes ? escapeCsvField(f.notes) : '';
      return `${date};${odometer};${liters};${pricePerLiter};${totalCost};${isFull};${notes}`;
    });
    const csv = [header, ...lines].join('\n');

    const today = new Date();
    const yyyymmdd = `${today.getUTCFullYear()}${String(today.getUTCMonth() + 1).padStart(2, '0')}${String(
      today.getUTCDate()
    ).padStart(2, '0')}`;
    const namePart = sanitizeForFilename(vehicle.name || vehicle.id);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="fillups_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/fillups/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
