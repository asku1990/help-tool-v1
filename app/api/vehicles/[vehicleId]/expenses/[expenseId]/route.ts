import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';

const UpdateSchema = z.object({
  date: z.string().optional(),
  category: z
    .enum([
      'FUEL',
      'MAINTENANCE',
      'INSURANCE',
      'TAX',
      'PARKING',
      'TOLL',
      'OIL_CHANGE',
      'OIL_TOP_UP',
      'INSPECTION',
      'TIRES',
      'OTHER',
    ])
    .optional(),
  amount: z.number().optional(),
  vendor: z.string().nullable().optional(),
  odometerKm: z.number().int().nullable().optional(),
  liters: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ vehicleId: string; expenseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();
    const { vehicleId, expenseId } = await context.params;
    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true },
    });
    if (!vehicle) return notFound();

    const existingExpense = await prisma.expense.findFirst({
      where: { id: expenseId, vehicleId: vehicle.id },
      select: {
        id: true,
        date: true,
        category: true,
        vendor: true,
        odometerKm: true,
        liters: true,
      },
    });
    if (!existingExpense) return notFound();

    const nextDate = parsed.data.date ? new Date(parsed.data.date) : existingExpense.date;
    const nextCategory = parsed.data.category ?? existingExpense.category;
    const nextOdometerKm =
      parsed.data.odometerKm === undefined ? existingExpense.odometerKm : parsed.data.odometerKm;
    const nextLiters =
      parsed.data.liters === undefined ? existingExpense.liters : parsed.data.liters;

    const resolvedOdometerKm = typeof nextOdometerKm === 'number' ? nextOdometerKm : null;
    const resolvedLiters = nextLiters === null ? null : decimalToNumber(nextLiters);

    let oilConsumption: number | null | undefined;
    if (nextCategory !== 'OIL_TOP_UP') {
      oilConsumption = null;
    } else if (
      resolvedOdometerKm !== null &&
      resolvedLiters !== null &&
      Number.isFinite(resolvedLiters)
    ) {
      // Recalculate oilConsumption for OIL_TOP_UP expenses (same logic as POST)
      const lastOilChange = await prisma.expense.findFirst({
        where: { vehicleId: vehicle.id, category: 'OIL_CHANGE' },
        orderBy: { date: 'desc' },
        select: { date: true, odometerKm: true },
      });

      if (lastOilChange?.odometerKm !== null && lastOilChange?.odometerKm !== undefined) {
        const topUpsSince = await prisma.expense.findMany({
          where: {
            vehicleId: vehicle.id,
            category: 'OIL_TOP_UP',
            date: { gt: lastOilChange.date },
            NOT: { id: existingExpense.id },
          },
          select: { liters: true },
        });

        const previousTopUpLiters = topUpsSince.reduce(
          (sum, e) => sum + (e.liters ? decimalToNumber(e.liters) : 0),
          0
        );
        const totalLiters = previousTopUpLiters + resolvedLiters;
        const distance = resolvedOdometerKm - lastOilChange.odometerKm;

        if (distance > 0 && totalLiters > 0) {
          oilConsumption = (totalLiters / distance) * 10000; // L per 10,000 km
        } else {
          oilConsumption = null;
        }
      } else {
        oilConsumption = null;
      }
    } else {
      oilConsumption = null;
    }

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        date: parsed.data.date ? nextDate : undefined,
        category: parsed.data.category ? nextCategory : undefined,
        amount: parsed.data.amount,
        vendor: parsed.data.vendor === undefined ? undefined : (parsed.data.vendor ?? null),
        odometerKm:
          parsed.data.odometerKm === undefined ? undefined : (parsed.data.odometerKm ?? null),
        liters: parsed.data.liters === undefined ? undefined : (parsed.data.liters ?? null),
        oilConsumption,
        notes: parsed.data.notes === undefined ? undefined : (parsed.data.notes ?? null),
      },
      select: { id: true },
    });
    return ok({ id: updated.id });
  } catch (error) {
    logger.error('PATCH /api/vehicles/[vehicleId]/expenses/[expenseId] failed', { error });
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ vehicleId: string; expenseId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();
    const { vehicleId, expenseId } = await context.params;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true },
    });
    if (!vehicle) return notFound();
    await prisma.expense.delete({ where: { id: expenseId } });
    return ok({ id: expenseId });
  } catch (error) {
    logger.error('DELETE /api/vehicles/[vehicleId]/expenses/[expenseId] failed', { error });
    return serverError();
  }
}
