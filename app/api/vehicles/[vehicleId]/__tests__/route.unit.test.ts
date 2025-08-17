// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, PATCH } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn(), update: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));

type PrismaMock = {
  vehicle: { findFirst: Mock; update: Mock };
};

describe('api/vehicles/[vehicleId] route (unit)', () => {
  it('GET returns 404 when vehicle not owned', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const req = new NextRequest('http://localhost/api/vehicles/v1');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    expect(res.status).toBe(404);
  });

  it('PATCH returns 400 on validation error', async () => {
    const base = new Request('http://localhost/api/vehicles/v1', {
      method: 'PATCH',
      body: JSON.stringify({ year: 'invalid' }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    expect(res.status).toBe(400);
  });

  it('PATCH allows null vs undefined fields and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v1' });
    prisma.vehicle.update.mockResolvedValueOnce({ id: 'v1' });
    const base = new Request('http://localhost/api/vehicles/v1', {
      method: 'PATCH',
      body: JSON.stringify({
        licensePlate: null,
        inspectionDueDate: null,
        inspectionIntervalMonths: null,
      }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v1' }) });
    expect(res.status).toBe(200);
  });
});
