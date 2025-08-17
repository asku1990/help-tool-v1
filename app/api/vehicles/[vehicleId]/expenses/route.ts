import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';

export async function GET(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50', 10), 1), 100);
    const cursor = url.searchParams.get('cursor') || undefined;

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

    const items = await prisma.expense.findMany({
      where: { vehicleId: vehicle.id },
      orderBy: { date: 'desc' },
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
  category: z.enum(['FUEL', 'MAINTENANCE', 'INSURANCE', 'TAX', 'PARKING', 'TOLL', 'OTHER']),
  amount: z.number(),
  vendor: z.string().optional(),
  odometerKm: z.number().int().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const parsed = CreateExpenseSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { date, category, amount, vendor, odometerKm, notes } = parsed.data;

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
    });
    if (!vehicle) return notFound();

    const createdExpense = await prisma.expense.create({
      data: {
        vehicleId: vehicle.id,
        date: new Date(date),
        category,
        amount,
        vendor: vendor || undefined,
        odometerKm: typeof odometerKm === 'number' ? odometerKm : undefined,
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
