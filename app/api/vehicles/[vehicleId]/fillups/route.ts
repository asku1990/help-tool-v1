import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';

function decimalToNumber(value: unknown): number {
  // Handles Prisma.Decimal, string, or number
  // @ts-expect-error Prisma.Decimal runtime type: toNumber exists on Prisma.Decimal
  if (value && typeof value === 'object' && typeof value.toNumber === 'function') {
    // @ts-expect-error Prisma.Decimal runtime type: call toNumber safely
    return value.toNumber();
  }
  if (typeof value === 'string') return parseFloat(value);
  if (typeof value === 'number') return value;
  return NaN;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { vehicleId } = await context.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, user: { email: session.user.email } },
  });
  if (!vehicle) return Response.json({ error: 'Not found' }, { status: 404 });

  const fillUps = await prisma.fuelFillUp.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { date: 'desc' },
  });

  const data = fillUps.map(f => ({
    id: f.id,
    date: f.date.toISOString(),
    odometerKm: f.odometerKm,
    liters: decimalToNumber(f.liters),
    pricePerLiter: decimalToNumber(f.pricePerLiter),
    totalCost: decimalToNumber(f.totalCost),
    isFull: f.isFull,
    notes: f.notes ?? undefined,
  }));

  return Response.json({ fillUps: data });
}

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, odometerKm, liters, pricePerLiter, totalCost, isFull, notes } = body as {
    date?: string;
    odometerKm?: number;
    liters?: number;
    pricePerLiter?: number;
    totalCost?: number;
    isFull?: boolean;
    notes?: string;
  };

  if (!date || typeof odometerKm !== 'number' || !liters || !pricePerLiter || !totalCost) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { vehicleId } = await context.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, user: { email: session.user.email } },
  });
  if (!vehicle) return Response.json({ error: 'Not found' }, { status: 404 });

  const created = await prisma.fuelFillUp.create({
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
  });

  return Response.json({ id: created.id }, { status: 201 });
}
