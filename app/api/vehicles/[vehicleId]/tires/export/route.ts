import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';

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

    // Fetch tire sets with all fields for backup
    const tireSets = await prisma.tireSet.findMany({
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
    });

    // Fetch all change logs for backup
    const changeLogs = await prisma.tireChangeLog.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { date: 'desc' },
      select: {
        id: true,
        tireSetId: true,
        date: true,
        odometerKm: true,
        notes: true,
        createdAt: true,
      },
    });

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const namePart = sanitizeForFilename(vehicle.name || vehicle.id);

    // Build combined CSV with sections
    const lines: string[] = [];

    // Section: TIRE_SETS
    lines.push('[TIRE_SETS]');
    lines.push('Id;Name;Type;Status;TotalKm;PurchaseDate;Notes;CreatedAt;UpdatedAt');
    for (const ts of tireSets) {
      const id = ts.id;
      const name = escapeCsvField(ts.name);
      const type = ts.type;
      const status = ts.status;
      const totalKm = ts.totalKm;
      const purchaseDate = ts.purchaseDate ? ts.purchaseDate.toISOString().slice(0, 10) : '';
      const notes = ts.notes ? escapeCsvField(ts.notes) : '';
      const createdAt = ts.createdAt.toISOString();
      const updatedAt = ts.updatedAt.toISOString();
      lines.push(
        `${id};${name};${type};${status};${totalKm};${purchaseDate};${notes};${createdAt};${updatedAt}`
      );
    }

    // Empty line separator
    lines.push('');

    // Section: CHANGE_LOGS
    lines.push('[CHANGE_LOGS]');
    lines.push('Id;TireSetId;Date;OdometerKm;Notes;CreatedAt');
    for (const cl of changeLogs) {
      const id = cl.id;
      const tireSetId = cl.tireSetId;
      const date = cl.date.toISOString().slice(0, 10);
      const odometerKm = cl.odometerKm;
      const notes = cl.notes ? escapeCsvField(cl.notes) : '';
      const createdAt = cl.createdAt.toISOString();
      lines.push(`${id};${tireSetId};${date};${odometerKm};${notes};${createdAt}`);
    }

    const csv = lines.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="tires_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/tires/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
