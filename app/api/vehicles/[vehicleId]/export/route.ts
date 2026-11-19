import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { escapeCsvField, sanitizeForFilename } from './csv';
import { escapeSpreadsheetField } from './csv/escapeSpreadsheetField';
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

    const spreadsheet = req.nextUrl.searchParams.get('format') === 'spreadsheet';
    const delimiter = spreadsheet ? ',' : ';';
    const escapeText = spreadsheet ? escapeSpreadsheetField : escapeCsvField;
    const lines: string[] = [];
    const writeRow = (...fields: (string | number)[]) => lines.push(fields.join(delimiter));
    const startSection = (name: string, columns: string) => {
      if (lines.length > 0) lines.push('');
      lines.push(spreadsheet ? `Section: ${name}` : `[${name}]`);
      writeRow(...columns.split(';'));
    };

    // Section: VEHICLE
    startSection(
      'VEHICLE',
      'Id;Name;Make;Model;Year;LicensePlate;InspectionDueDate;InspectionIntervalMonths;InitialOdometer'
    );
    const vName = escapeText(vehicle.name);
    const vMake = vehicle.make ? escapeText(vehicle.make) : '';
    const vModel = vehicle.model ? escapeText(vehicle.model) : '';
    const vYear = vehicle.year ?? '';
    const vPlate = vehicle.licensePlate ? escapeText(vehicle.licensePlate) : '';
    const vInspDate = vehicle.inspectionDueDate
      ? vehicle.inspectionDueDate.toISOString().slice(0, 10)
      : '';
    const vInspInterval = vehicle.inspectionIntervalMonths ?? '';
    const vInitOdo = vehicle.initialOdometer ?? '';
    writeRow(vehicle.id, vName, vMake, vModel, vYear, vPlate, vInspDate, vInspInterval, vInitOdo);

    // Section: FILLUPS
    startSection('FILLUPS', 'Id;Date;OdometerKm;Liters;PricePerLiter;TotalCost;IsFull;Notes');
    for (const f of fillUps) {
      const id = f.id;
      const date = f.date.toISOString().slice(0, 10);
      const odometer = f.odometerKm;
      const liters = decimalToNumber(f.liters).toFixed(2);
      const pricePerLiter = decimalToNumber(f.pricePerLiter).toFixed(3);
      const totalCost = decimalToNumber(f.totalCost).toFixed(2);
      const isFull = f.isFull ? '1' : '0';
      const notes = f.notes ? escapeText(f.notes) : '';
      writeRow(id, date, odometer, liters, pricePerLiter, totalCost, isFull, notes);
    }

    // Section: EXPENSES
    startSection('EXPENSES', 'Id;Date;Km;Amount;Category;Vendor;Liters;OilConsumption;Notes');
    for (const e of expenses) {
      const id = e.id;
      const date = e.date.toISOString().slice(0, 10);
      const km = e.odometerKm ?? '';
      const amount = decimalToNumber(e.amount).toFixed(2);
      const category = e.category;
      const vendor = e.vendor ? escapeText(e.vendor) : '';
      const liters = e.liters != null ? decimalToNumber(e.liters).toFixed(2) : '';
      const oilConsumption =
        e.oilConsumption != null ? decimalToNumber(e.oilConsumption).toFixed(2) : '';
      const notes = e.notes ? escapeText(e.notes) : '';
      writeRow(id, date, km, amount, category, vendor, liters, oilConsumption, notes);
    }

    // Section: TIRE_SETS
    startSection('TIRE_SETS', 'Id;Name;Type;Status;TotalKm;PurchaseDate;Notes;CreatedAt;UpdatedAt');
    for (const ts of tireSets) {
      const id = ts.id;
      const name = escapeText(ts.name);
      const type = ts.type;
      const status = ts.status;
      const totalKm = ts.totalKm;
      const purchaseDate = ts.purchaseDate ? ts.purchaseDate.toISOString().slice(0, 10) : '';
      const notes = ts.notes ? escapeText(ts.notes) : '';
      const createdAt = ts.createdAt.toISOString();
      const updatedAt = ts.updatedAt.toISOString();
      writeRow(id, name, type, status, totalKm, purchaseDate, notes, createdAt, updatedAt);
    }

    // Section: CHANGE_LOGS
    startSection('CHANGE_LOGS', 'Id;TireSetId;Date;OdometerKm;Notes;CreatedAt');
    for (const cl of changeLogs) {
      const id = cl.id;
      const tireSetId = cl.tireSetId;
      const date = cl.date.toISOString().slice(0, 10);
      const odometerKm = cl.odometerKm;
      const notes = cl.notes ? escapeText(cl.notes) : '';
      const createdAt = cl.createdAt.toISOString();
      writeRow(id, tireSetId, date, odometerKm, notes, createdAt);
    }

    const csv = spreadsheet ? `\uFEFF${lines.join('\r\n')}` : lines.join('\n');
    const filenamePrefix = spreadsheet ? 'spreadsheet' : 'backup';

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${filenamePrefix}_${namePart}_${yyyymmdd}.csv"`,
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/export failed', { error });
    return new Response('Server error', { status: 500 });
  }
}
