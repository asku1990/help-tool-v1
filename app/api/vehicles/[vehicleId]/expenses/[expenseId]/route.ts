import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import type { Expense, Prisma } from '@/generated/prisma';
import { ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { decimalToNumber } from '@/lib/prisma/decimal';
import { calculateOilConsumption } from '@/lib/oil-consumption';
import { checkRateLimit, rateLimitHeaders, recordEditRateLimitKey } from '@/lib/api/rate-limit';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

const UpdateSchema = z.object({
  date: z.string().min(1, 'Date cannot be empty').optional(),
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
  odometerKm: z.int32().nullable().optional(),
  liters: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ vehicleId: string; expenseId: string }> }
) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();
    const { vehicleId, expenseId } = await context.params;
    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());

    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const rateLimit = checkRateLimit(recordEditRateLimitKey(userId, vehicleId));
    if (!rateLimit.allowed) {
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rateLimit.retryAfterMs),
      });
    }
    const { date, ...fields } = parsed.data;
    const where = { id: expenseId, vehicleId: access.vehicle.id };
    const data = { ...fields, date: date ? new Date(date) : undefined };
    const select = { id: true } as const;
    const affectsOilConsumption =
      date !== undefined ||
      fields.category !== undefined ||
      fields.odometerKm !== undefined ||
      fields.liters !== undefined;
    const updated = affectsOilConsumption
      ? await prisma.$transaction(async tx => {
          // Updating first locks the row and returns the persisted inputs for the calculation.
          const expense = await tx.expense.update({
            where,
            data,
            select: { date: true, category: true, odometerKm: true, liters: true },
          });
          const oilConsumption = await recalculateOilConsumption(tx, where, expense);
          return tx.expense.update({ where, data: { oilConsumption }, select });
        })
      : await prisma.expense.update({ where, data, select });
    return ok({ id: updated.id });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return notFound();
    }
    logger.error('PATCH /api/vehicles/[vehicleId]/expenses/[expenseId] failed', { error });
    return serverError();
  }
}

async function recalculateOilConsumption(
  tx: Prisma.TransactionClient,
  { id, vehicleId }: { id: string; vehicleId: string },
  {
    date,
    category,
    odometerKm,
    liters,
  }: Pick<Expense, 'date' | 'category' | 'odometerKm' | 'liters'>
): Promise<number | null> {
  if (category !== 'OIL_TOP_UP' || odometerKm === null || liters === null) return null;

  const lastOilChange = await tx.expense.findFirst({
    where: { vehicleId, category: 'OIL_CHANGE' },
    orderBy: { date: 'desc' },
    select: { date: true, odometerKm: true },
  });
  if (lastOilChange?.odometerKm == null) return null;

  const topUpsSince = await tx.expense.findMany({
    where: {
      vehicleId,
      category: 'OIL_TOP_UP',
      date: { gt: lastOilChange.date, lte: date },
      NOT: { id },
    },
    select: { date: true, odometerKm: true, liters: true },
  });
  return calculateOilConsumption(
    { date, odometerKm, liters: decimalToNumber(liters) },
    lastOilChange.odometerKm,
    topUpsSince.map(e => ({ ...e, liters: e.liters === null ? null : decimalToNumber(e.liters) }))
  );
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ vehicleId: string; expenseId: string }> }
) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();
    const { vehicleId, expenseId } = await context.params;
    const access = await getVehicleAccess(vehicleId, userId);
    if (!access || !hasPermission(access.role, 'write')) return notFound();
    const deleted = await prisma.expense.deleteMany({
      where: { id: expenseId, vehicleId: access.vehicle.id },
    });
    if (deleted.count === 0) return notFound();
    return ok({ id: expenseId });
  } catch (error) {
    logger.error('DELETE /api/vehicles/[vehicleId]/expenses/[expenseId] failed', { error });
    return serverError();
  }
}
