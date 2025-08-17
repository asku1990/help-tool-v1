import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { z } from 'zod';
import { ok, created, unauthorized, badRequest, notFound, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function GET(): Promise<Response> {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return ok({ vehicles: [] }, { headers: { 'Cache-Control': 'private, max-age=30' } });

    const vehicles = await prisma.vehicle.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, make: true, model: true, year: true },
    });

    return ok({ vehicles }, { headers: { 'Cache-Control': 'private, max-age=30' } });
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
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const parsed = CreateVehicleSchema.safeParse(await req.json());
    if (!parsed.success) {
      return badRequest('VALIDATION_ERROR', 'Invalid request body', parsed.error.flatten());
    }
    const { name, make, model, year } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return notFound('User not found');

    const createdVehicle = await prisma.vehicle.create({
      data: {
        userId: user.id,
        name: name.trim(),
        make: make?.trim() || undefined,
        model: model?.trim() || undefined,
        year: typeof year === 'number' ? year : undefined,
      },
      select: { id: true },
    });

    return created({ id: createdVehicle.id });
  } catch (error) {
    logger.error('POST /api/vehicles failed', { error });
    return serverError();
  }
}
