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

  const expenses = await prisma.expense.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { date: 'desc' },
  });

  const data = expenses.map(e => ({
    id: e.id,
    date: e.date.toISOString(),
    category: e.category,
    amount: decimalToNumber(e.amount),
    vendor: e.vendor ?? undefined,
    odometerKm: e.odometerKm ?? undefined,
    notes: e.notes ?? undefined,
  }));

  const expensesTotal = data.reduce((s, e) => s + (e.amount || 0), 0);
  return Response.json({ expenses: data, expensesTotal });
}

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { date, category, amount, vendor, odometerKm, notes } = body as {
    date?: string;
    category?: 'FUEL' | 'MAINTENANCE' | 'INSURANCE' | 'TAX' | 'PARKING' | 'TOLL' | 'OTHER';
    amount?: number;
    vendor?: string;
    odometerKm?: number;
    notes?: string;
  };

  if (!date || !category || !amount) {
    return Response.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const { vehicleId } = await context.params;

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, user: { email: session.user.email } },
  });
  if (!vehicle) return Response.json({ error: 'Not found' }, { status: 404 });

  const created = await prisma.expense.create({
    data: {
      vehicleId: vehicle.id,
      date: new Date(date),
      category,
      amount,
      vendor: vendor || undefined,
      odometerKm: typeof odometerKm === 'number' ? odometerKm : undefined,
      notes: notes || undefined,
    },
  });

  return Response.json({ id: created.id }, { status: 201 });
}
