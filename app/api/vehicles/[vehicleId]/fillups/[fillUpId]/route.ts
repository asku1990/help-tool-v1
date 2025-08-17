import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, unauthorized, notFound, badRequest, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

const UpdateSchema = z.object({
  date: z.string().optional(),
  odometerKm: z.number().int().optional(),
  liters: z.number().optional(),
  pricePerLiter: z.number().optional(),
  totalCost: z.number().optional(),
  isFull: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ vehicleId: string; fillUpId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();
    const { vehicleId, fillUpId } = await context.params;
    const parsed = UpdateSchema.safeParse(await req.json());
    if (!parsed.success)
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true },
    });
    if (!vehicle) return notFound();

    const updated = await prisma.fuelFillUp.update({
      where: { id: fillUpId },
      data: {
        date: parsed.data.date ? new Date(parsed.data.date) : undefined,
        odometerKm: parsed.data.odometerKm,
        liters: parsed.data.liters,
        pricePerLiter: parsed.data.pricePerLiter,
        totalCost: parsed.data.totalCost,
        isFull: parsed.data.isFull,
        notes: parsed.data.notes === undefined ? undefined : (parsed.data.notes ?? null),
      },
      select: { id: true },
    });
    return ok({ id: updated.id });
  } catch (error) {
    let code: string | undefined;
    if (error && typeof error === 'object' && 'code' in error) {
      code = (error as { code?: string }).code;
    }
    if (code === 'P2025') {
      return notFound();
    }
    logger.error('PATCH /api/vehicles/[vehicleId]/fillups/[fillUpId] failed', { error });
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ vehicleId: string; fillUpId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();
    const { vehicleId, fillUpId } = await context.params;
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true },
    });
    if (!vehicle) return notFound();
    await prisma.fuelFillUp.delete({ where: { id: fillUpId } });
    return ok({ id: fillUpId });
  } catch (error) {
    let code: string | undefined;
    if (error && typeof error === 'object' && 'code' in error) {
      code = (error as { code?: string }).code;
    }
    if (code === 'P2025') {
      return notFound();
    }
    logger.error('DELETE /api/vehicles/[vehicleId]/fillups/[fillUpId] failed', { error });
    return serverError();
  }
}
