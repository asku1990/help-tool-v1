import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { ok, unauthorized, notFound, serverError, badRequest } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export async function GET(_req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
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
      },
    });
    if (!vehicle) return notFound();

    return ok({ vehicle }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId] failed', { error });
    return serverError();
  }
}

const UpdateVehicleSchema = z.object({
  name: z.string().trim().min(1).optional(),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.number().int().optional(),
  licensePlate: z
    .string()
    .trim()
    .max(16)
    .regex(/^[A-Za-z0-9\-\s]*$/)
    .optional()
    .nullable(),
  inspectionDueDate: z
    .string()
    .refine(v => v == null || v === '' || !Number.isNaN(new Date(v).getTime()), 'Invalid date')
    .optional()
    .nullable(),
  inspectionIntervalMonths: z.number().int().min(1).max(60).optional().nullable(),
});

export async function PATCH(req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }
    const { vehicleId } = await context.params;
    const body = await req.json();
    const parsed = UpdateVehicleSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const data = parsed.data;
    const owner = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true },
    });
    if (!owner) return notFound();

    const updated = await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        name: data.name?.trim(),
        make: data.make?.trim(),
        model: data.model?.trim(),
        year: typeof data.year === 'number' ? data.year : undefined,
        licensePlate: data.licensePlate?.trim() ?? (data.licensePlate === null ? null : undefined),
        inspectionDueDate: data.inspectionDueDate
          ? new Date(data.inspectionDueDate)
          : data.inspectionDueDate === null
            ? null
            : undefined,
        inspectionIntervalMonths:
          typeof data.inspectionIntervalMonths === 'number'
            ? data.inspectionIntervalMonths
            : data.inspectionIntervalMonths === null
              ? null
              : undefined,
      },
      select: { id: true },
    });
    return ok({ id: updated.id });
  } catch (error) {
    logger.error('PATCH /api/vehicles/[vehicleId] failed', { error });
    return serverError();
  }
}
