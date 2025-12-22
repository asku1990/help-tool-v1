import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { logger } from '@/lib/logger';

type RouteContext = { params: Promise<{ vehicleId: string; tireSetId: string }> };

async function getVehicleAndTireSet(vehicleId: string, tireSetId: string, userEmail: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, user: { email: userEmail } },
    select: { id: true },
  });
  if (!vehicle) return { vehicle: null, tireSet: null };

  const tireSet = await prisma.tireSet.findFirst({
    where: { id: tireSetId, vehicleId: vehicle.id },
  });
  return { vehicle, tireSet };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    const { vehicleId, tireSetId } = await context.params;
    const { vehicle, tireSet } = await getVehicleAndTireSet(
      vehicleId,
      tireSetId,
      session.user.email
    );

    if (!vehicle) return notFound('Vehicle not found');
    if (!tireSet) return notFound('Tire set not found');

    return ok({
      tireSet: {
        ...tireSet,
        purchaseDate: tireSet.purchaseDate?.toISOString() ?? null,
        createdAt: tireSet.createdAt.toISOString(),
        updatedAt: tireSet.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId]/tires/[tireSetId] failed', { error });
    return serverError();
  }
}

const UpdateTireSetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(['SUMMER', 'WINTER', 'ALL_SEASON']).optional(),
  status: z.enum(['ACTIVE', 'STORED', 'RETIRED']).optional(),
  purchaseDate: z
    .string()
    .refine(v => !v || !Number.isNaN(new Date(v).getTime()), 'Invalid date format')
    .optional()
    .nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    const { vehicleId, tireSetId } = await context.params;
    const { vehicle, tireSet } = await getVehicleAndTireSet(
      vehicleId,
      tireSetId,
      session.user.email
    );

    if (!vehicle) return notFound('Vehicle not found');
    if (!tireSet) return notFound('Tire set not found');

    const body = await req.json();
    const parsed = UpdateTireSetSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { name, type, status, purchaseDate, notes } = parsed.data;

    // If setting this tire to ACTIVE, set all other non-RETIRED tires to STORED
    if (status === 'ACTIVE') {
      await prisma.tireSet.updateMany({
        where: {
          vehicleId: vehicle.id,
          id: { not: tireSetId },
          status: { not: 'RETIRED' },
        },
        data: { status: 'STORED' },
      });
    }

    const updated = await prisma.tireSet.update({
      where: { id: tireSetId },
      data: {
        name: name ?? undefined,
        type: type ?? undefined,
        status: status ?? undefined,
        purchaseDate: purchaseDate
          ? new Date(purchaseDate)
          : purchaseDate === null
            ? null
            : undefined,
        notes: notes !== undefined ? notes : undefined,
      },
      select: { id: true },
    });

    return ok({ id: updated.id });
  } catch (error) {
    logger.error('PATCH /api/vehicles/[vehicleId]/tires/[tireSetId] failed', { error });
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.email) return unauthorized();

    const { vehicleId, tireSetId } = await context.params;
    const { vehicle, tireSet } = await getVehicleAndTireSet(
      vehicleId,
      tireSetId,
      session.user.email
    );

    if (!vehicle) return notFound('Vehicle not found');
    if (!tireSet) return notFound('Tire set not found');

    await prisma.tireSet.delete({
      where: { id: tireSetId },
    });

    return ok({ id: tireSetId });
  } catch (error) {
    logger.error('DELETE /api/vehicles/[vehicleId]/tires/[tireSetId] failed', { error });
    return serverError();
  }
}
