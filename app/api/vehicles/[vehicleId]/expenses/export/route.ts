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

    // Only CSV export is supported

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true, name: true },
    });
    if (!vehicle) {
      return new Response('Not found', { status: 404 });
    }

    const expenses = await prisma.expense.findMany({
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
    });

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const namePart = sanitizeForFilename(vehicle.name || vehicle.id);

    // Default CSV format with all fields for backup
    const header = 'Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes';
    const lines = expenses.map(e => {
      const id = e.id;
      const date = e.date.toISOString().slice(0, 10);
      const km = e.odometerKm ?? '';
      const amount = decimalToNumber(e.amount).toFixed(2);
      const category = e.category;
      const vendor = e.vendor ? escapeCsvField(e.vendor) : '';
      const liters = e.liters != null ? decimalToNumber(e.liters).toFixed(2) : '';
      const oilConsumption =
        e.oilConsumption != null ? decimalToNumber(e.oilConsumption).toFixed(2) : '';
      const notes = e.notes ? escapeCsvField(e.notes) : '';
      return `${id};${date};${km};${amount};${category};${vendor};${liters};${oilConsumption};${notes}`;
    });
    const csv = [header, ...lines].join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="expenses_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/expenses/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
