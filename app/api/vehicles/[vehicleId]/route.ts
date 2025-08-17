import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';
import { ok, unauthorized, notFound, serverError } from '@/lib/api/response';
import { logger } from '@/lib/logger';

export async function GET(_req: NextRequest, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return unauthorized();
    }

    const { vehicleId } = await context.params;

    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, user: { email: session.user.email } },
      select: { id: true, name: true, make: true, model: true, year: true },
    });
    if (!vehicle) return notFound();

    return ok({ vehicle }, { headers: { 'Cache-Control': 'private, max-age=30' } });
  } catch (error) {
    logger.error('GET /api/vehicles/[vehicleId] failed', { error });
    return serverError();
  }
}
