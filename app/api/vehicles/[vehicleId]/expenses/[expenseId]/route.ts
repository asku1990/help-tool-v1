import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const UpdateSchema = z.object({
  date: z.string().optional(),
  category: z
    .enum(['FUEL', 'MAINTENANCE', 'INSURANCE', 'TAX', 'PARKING', 'TOLL', 'OTHER'])
    .optional(),
  amount: z.number().optional(),
  vendor: z.string().nullable().optional(),
  odometerKm: z.number().int().nullable().optional(),
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

    const updated = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        category: parsed.data.category,
        amount: parsed.data.amount,
        vendor: parsed.data.vendor === undefined ? undefined : (parsed.data.vendor ?? null),
        odometerKm:
          parsed.data.odometerKm === undefined ? undefined : (parsed.data.odometerKm ?? null),
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
