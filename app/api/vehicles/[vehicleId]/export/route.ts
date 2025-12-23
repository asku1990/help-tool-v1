import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';

export function escapeCsvField(value: string): string {
  const mustQuote = /[";\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

export function sanitizeForFilename(input: string): string {
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
      select: {
        id: true,
        name: true,
        make: true,
        model: true,
        year: true,
        licensePlate: true,
        inspectionDueDate: true,
        inspectionIntervalMonths: true,
        initialOdometer: true,
      },
    });
    if (!vehicle) {
      return new Response('Not found', { status: 404 });
    }

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
        orderBy: { date: 'desc' },
        select: {
          id: true,
          tireSetId: true,
          date: true,
          odometerKm: true,
          notes: true,
          createdAt: true,
        },
      }),
    ]);

    const today = new Date();
    const yyyymmdd = today.toISOString().slice(0, 10).replace(/-/g, '');
    const namePart = sanitizeForFilename(vehicle.name || vehicle.id);

    // Build combined CSV with sections
    const lines: string[] = [];

    // Section: VEHICLE
    lines.push('[VEHICLE]');
    lines.push(
      'Id;Name;Make;Model;Year;LicensePlate;InspectionDueDate;InspectionIntervalMonths;InitialOdometer'
    );
    const vName = escapeCsvField(vehicle.name);
    const vMake = vehicle.make ? escapeCsvField(vehicle.make) : '';
    const vModel = vehicle.model ? escapeCsvField(vehicle.model) : '';
    const vYear = vehicle.year ?? '';
    const vPlate = vehicle.licensePlate ? escapeCsvField(vehicle.licensePlate) : '';
    const vInspDate = vehicle.inspectionDueDate
      ? vehicle.inspectionDueDate.toISOString().slice(0, 10)
      : '';
    const vInspInterval = vehicle.inspectionIntervalMonths ?? '';
    const vInitOdo = vehicle.initialOdometer ?? '';
    lines.push(
      `${vehicle.id};${vName};${vMake};${vModel};${vYear};${vPlate};${vInspDate};${vInspInterval};${vInitOdo}`
    );

    // Section: FILLUPS
    lines.push('');
    lines.push('[FILLUPS]');
    lines.push('Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes');
    for (const f of fillUps) {
      const id = f.id;
      const date = f.date.toISOString().slice(0, 10);
      const odometer = f.odometerKm;
      const liters = decimalToNumber(f.liters).toFixed(2);
      const pricePerLiter = decimalToNumber(f.pricePerLiter).toFixed(3);
      const totalCost = decimalToNumber(f.totalCost).toFixed(2);
      const isFull = f.isFull ? '1' : '0';
      const notes = f.notes ? escapeCsvField(f.notes) : '';
      lines.push(
        `${id};${date};${odometer};${liters};${pricePerLiter};${totalCost};${isFull};${notes}`
      );
    }

    // Section: EXPENSES
    lines.push('');
    lines.push('[EXPENSES]');
    lines.push('Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes');
    for (const e of expenses) {
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
      lines.push(
        `${id};${date};${km};${amount};${category};${vendor};${liters};${oilConsumption};${notes}`
      );
    }

    // Section: TIRE_SETS
    lines.push('');
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

    // Section: CHANGE_LOGS
    lines.push('');
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
        'Content-Disposition': `attachment; filename="backup_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
