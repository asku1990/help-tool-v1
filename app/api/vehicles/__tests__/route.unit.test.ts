// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    user: { findUnique: vi.fn() },
    vehicle: { findMany: vi.fn(), create: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));

type PrismaMock = {
  user: { findUnique: Mock };
  vehicle: { findMany: Mock; create: Mock };
};

describe('api/vehicles route (unit)', () => {
  it('GET returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/vehicles');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('GET returns list of vehicles for user', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
    prisma.vehicle.findMany.mockResolvedValueOnce([{ id: 'v1', name: 'Car' }]);
    const req = new NextRequest('http://localhost/api/vehicles');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.data.vehicles)).toBe(true);
  });

  it('POST validates payload and returns 400 on invalid body', async () => {
    const base = new Request('http://localhost/api/vehicles', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const req = new NextRequest(base);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('POST creates vehicle and returns 201', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' });
    prisma.vehicle.create.mockResolvedValueOnce({ id: 'v1' });
    const base = new Request('http://localhost/api/vehicles', {
      method: 'POST',
      body: JSON.stringify({ name: 'Car' }),
    });
    const req = new NextRequest(base);
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
