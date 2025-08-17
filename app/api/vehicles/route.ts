import { NextRequest } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/db';

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ vehicles: [] });

  const vehicles = await prisma.vehicle.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, make: true, model: true, year: true },
  });

  return Response.json({ vehicles });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { name, make, model, year } = body as {
    name?: string;
    make?: string;
    model?: string;
    year?: number;
  };

  if (!name?.trim()) {
    return Response.json({ error: 'Name is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });

  const created = await prisma.vehicle.create({
    data: {
      userId: user.id,
      name: name.trim(),
      make: make?.trim() || undefined,
      model: model?.trim() || undefined,
      year: typeof year === 'number' ? year : undefined,
    },
    select: { id: true },
  });

  return Response.json({ id: created.id }, { status: 201 });
}
