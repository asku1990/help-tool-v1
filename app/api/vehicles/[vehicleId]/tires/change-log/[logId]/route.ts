import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { badRequest, notFound, ok, serverError, unauthorized } from '@/lib/api/response';
import { logger } from '@/lib/logger';
import { getSessionUserId, getVehicleAccess, hasPermission } from '@/lib/api/vehicle-access';

type RouteContext = { params: Promise<{ vehicleId: string; logId: string }> };

async function getVehicleAndLog(vehicleId: string, logId: string, userId: string) {
  const access = await getVehicleAccess(vehicleId, userId);
  if (!access) return { vehicle: null, log: null, role: null };

  const log = await prisma.tireChangeLog.findFirst({
    where: { id: logId, vehicleId: access.vehicle.id },
    include: { tireSet: true },
  });
  return { vehicle: access.vehicle, log, role: access.role };
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();

    const { vehicleId, logId } = await context.params;
    const { vehicle, log, role } = await getVehicleAndLog(vehicleId, logId, userId);

    if (!vehicle || !role || !hasPermission(role, 'read')) return notFound('Vehicle not found');
    if (!log) return notFound('Change log not found');

    return ok({ log });
  } catch (error) {
    logger.error('GET /api/.../change-log/[logId] failed', { error });
    return serverError();
  }
}

const UpdateLogSchema = z.object({
  date: z
    .string()
    .refine(v => !Number.isNaN(new Date(v).getTime()), 'Invalid date format')
    .optional(),
  odometerKm: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();

    const { vehicleId, logId } = await context.params;
    const { vehicle, log, role } = await getVehicleAndLog(vehicleId, logId, userId);

    if (!vehicle || !role || !hasPermission(role, 'write')) return notFound('Vehicle not found');
    if (!log) return notFound('Change log not found');

    const body = await req.json();
    const parsed = UpdateLogSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }

    const { date, odometerKm, notes } = parsed.data;

    const updated = await prisma.tireChangeLog.update({
      where: { id: logId },
      data: {
        date: date ? new Date(date) : undefined,
        odometerKm: odometerKm !== undefined ? odometerKm : undefined,
        notes: notes === null ? null : notes || undefined,
      },
      select: { id: true },
    });

    return ok({ id: updated.id });
  } catch (error) {
    logger.error('PATCH /api/.../change-log/[logId] failed', { error });
    return serverError();
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) return unauthorized();

    const { vehicleId, logId } = await context.params;
    const { vehicle, log, role } = await getVehicleAndLog(vehicleId, logId, userId);

    if (!vehicle || !role || !hasPermission(role, 'write')) return notFound('Vehicle not found');
    if (!log) return notFound('Change log not found');

    await prisma.tireChangeLog.delete({
      where: { id: logId },
    });

    return ok({ id: logId });
  } catch (error) {
    logger.error('DELETE /api/.../change-log/[logId] failed', { error });
    return serverError();
  }
}
