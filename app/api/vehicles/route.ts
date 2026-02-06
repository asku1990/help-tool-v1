import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, badRequest, notFound, serverError } from '@/lib/api/response';
import { checkRateLimit, rateLimitHeaders, rateLimitKey } from '@/lib/api/rate-limit';
import { logger } from '@/lib/logger';
import { getSessionUserId } from '@/lib/api/vehicle-access';

export async function GET(req: NextRequest): Promise<Response> {
  try {
    // Basic rate limiting per IP+path
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) {
      return unauthorized();
    }

    const vehicles = await prisma.vehicle.findMany({
      where: { access: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        make: true,
        model: true,
        year: true,
        licensePlate: true,
        inspectionDueDate: true,
        inspectionIntervalMonths: true,
        initialOdometer: true,
      },
    });

    return ok({ vehicles }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('GET /api/vehicles failed', { error });
    return serverError();
  }
}

const CreateVehicleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  make: z.string().trim().optional(),
  model: z.string().trim().optional(),
  year: z.number().int().optional(),
  licensePlate: z
    .string()
    .trim()
    .max(16, 'License plate too long')
    .regex(/^[A-Za-z0-9\-\s]*$/, 'Only letters, digits, spaces, hyphen')
    .optional(),
  inspectionDueDate: z
    .string()
    .refine(v => !v || !Number.isNaN(new Date(v).getTime()), 'Invalid date format')
    .optional(),
  inspectionIntervalMonths: z.number().int().min(1).max(60).optional(),
  initialOdometer: z.number().int().min(0).optional(),
});

export async function POST(req: NextRequest) {
  try {
    // Basic rate limiting per IP+path
    const rl = checkRateLimit(rateLimitKey(req));
    if (!rl.allowed)
      return serverError('Rate limit exceeded', undefined, {
        status: 429,
        headers: rateLimitHeaders(rl.retryAfterMs),
      });
    const session = await auth();
    const userId = await getSessionUserId(session);
    if (!userId) {
      return unauthorized();
    }

    const parsed = CreateVehicleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const {
      name,
      make,
      model,
      year,
      licensePlate,
      inspectionDueDate,
      inspectionIntervalMonths,
      initialOdometer,
    } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return notFound('User not found');

    const createdVehicle = await prisma.$transaction(async tx => {
      const vehicle = await tx.vehicle.create({
        data: {
          userId: user.id,
          name: name.trim(),
          make: make?.trim() || undefined,
          model: model?.trim() || undefined,
          year: typeof year === 'number' ? year : undefined,
          licensePlate: licensePlate?.trim() || undefined,
          inspectionDueDate: inspectionDueDate ? new Date(inspectionDueDate) : undefined,
          inspectionIntervalMonths:
            typeof inspectionIntervalMonths === 'number' ? inspectionIntervalMonths : undefined,
          initialOdometer: typeof initialOdometer === 'number' ? initialOdometer : undefined,
        },
        select: { id: true },
      });

      await tx.vehicleAccess.create({
        data: {
          vehicleId: vehicle.id,
          userId: user.id,
          role: 'OWNER',
        },
      });

      return vehicle;
    });

    return created({ id: createdVehicle.id });
  } catch (error) {
    logger.error('POST /api/vehicles failed', { error });
    return serverError();
  }
}
