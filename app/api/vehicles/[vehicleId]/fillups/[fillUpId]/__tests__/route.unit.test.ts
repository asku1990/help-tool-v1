// @vitest-environment node
import { beforeEach, describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@/generated/prisma';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { PATCH, DELETE } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn() },
    fuelFillUp: { update: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));
vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: vi.fn(() => ({ allowed: true })),
}));

type PrismaMock = {
  vehicle: { findFirst: Mock };
  fuelFillUp: { update: Mock; delete: Mock };
  $transaction: Mock;
};

describe('api/vehicles/[vehicleId]/fillups/[fillUpId] route (unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([-2147483649, 2147483648])(
    'PATCH rejects out-of-range odometer %s without writing',
    async odometerKm => {
      const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
      const req = new NextRequest('http://localhost/x', {
        method: 'PATCH',
        body: JSON.stringify({ odometerKm }),
      });
      const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe('VALIDATION_ERROR');
      expect(prisma.fuelFillUp.update).not.toHaveBeenCalled();
    }
  );

  it('PATCH returns 429 before starting a transaction when the vehicle edit quota is exhausted', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    vi.mocked(checkRateLimit).mockReturnValueOnce({ allowed: false, retryAfterMs: 1500 });
    const req = new NextRequest('http://localhost/api/vehicles/v/fillups/f', {
      method: 'PATCH',
      body: JSON.stringify({ liters: 2 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('2');
    expect(checkRateLimit).toHaveBeenCalledExactlyOnceWith('record-edit:u@e:v');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.fuelFillUp.update).not.toHaveBeenCalled();
  });

  it('PATCH returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const base = new Request('http://localhost/x', { method: 'PATCH', body: JSON.stringify({}) });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
    expect(res.status).toBe(404);
  });

  it('DELETE returns 404 when not owner', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce(null);
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }),
    });
    expect(res.status).toBe(404);
  });

  it('PATCH clears notes without requiring other fields', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.update.mockResolvedValueOnce({ id: 'f' });
    const base = new Request('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ notes: null }),
    });
    const req = new NextRequest(base);
    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });
    expect(res.status).toBe(200);
    expect(prisma.fuelFillUp.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f', vehicleId: 'v' },
        data: expect.objectContaining({ notes: null }),
      })
    );
  });

  it('PATCH calculates cost from the changed liters and the persisted price in one transaction', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    const update = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'f',
        liters: new Prisma.Decimal(2),
        pricePerLiter: new Prisma.Decimal(1.75),
      })
      .mockResolvedValueOnce({ id: 'f' });
    prisma.$transaction.mockImplementationOnce(callback => callback({ fuelFillUp: { update } }));
    const req = new NextRequest('http://localhost/x', {
      method: 'PATCH',
      body: JSON.stringify({ liters: 2, totalCost: 99 }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }) });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'f', vehicleId: 'v' },
        data: { liters: 2, date: undefined },
      })
    );
    expect(update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'f', vehicleId: 'v' },
        data: { totalCost: new Prisma.Decimal(3.5) },
      })
    );
  });

  it('DELETE removes and returns 200', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.fuelFillUp.delete.mockResolvedValueOnce({ id: 'f' });
    const res = await DELETE(new NextRequest('http://localhost/x'), {
      params: Promise.resolve({ vehicleId: 'v', fillUpId: 'f' }),
    });
    expect(res.status).toBe(200);
    expect(prisma.fuelFillUp.delete).toHaveBeenCalledWith({
      where: { id: 'f', vehicleId: 'v' },
    });
  });

  it.each(['PATCH', 'DELETE'] as const)(
    '%s cannot change a fill-up belonging to another vehicle',
    async method => {
      const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
      prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'authorized-car' });
      const foreignFillUp = { id: 'foreign-fillup', vehicleId: 'other-car', liters: 10 };
      const write = method === 'PATCH' ? prisma.fuelFillUp.update : prisma.fuelFillUp.delete;
      write.mockImplementationOnce(
        async ({ where }: { where: { id: string; vehicleId?: string } }) => {
          if (where.vehicleId && where.vehicleId !== foreignFillUp.vehicleId) {
            throw Object.assign(new Error('Record not found'), { code: 'P2025' });
          }
          return { id: foreignFillUp.id };
        }
      );
      const req = new NextRequest('http://localhost/x', {
        method,
        ...(method === 'PATCH' ? { body: JSON.stringify({ notes: 'Updated note' }) } : {}),
      });
      const handler = method === 'PATCH' ? PATCH : DELETE;
      const res = await handler(req, {
        params: Promise.resolve({
          vehicleId: 'authorized-car',
          fillUpId: foreignFillUp.id,
        }),
      });

      expect(res.status).toBe(404);
      expect(write).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: foreignFillUp.id, vehicleId: 'authorized-car' },
        })
      );
    }
  );

  it.each(['PATCH', 'DELETE'] as const)('%s returns 404 for a missing fill-up', async method => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    const write = method === 'PATCH' ? prisma.fuelFillUp.update : prisma.fuelFillUp.delete;
    write.mockRejectedValueOnce(Object.assign(new Error('Record not found'), { code: 'P2025' }));
    const req = new NextRequest('http://localhost/x', {
      method,
      ...(method === 'PATCH' ? { body: JSON.stringify({ notes: 'Updated note' }) } : {}),
    });
    const handler = method === 'PATCH' ? PATCH : DELETE;
    const res = await handler(req, {
      params: Promise.resolve({ vehicleId: 'v', fillUpId: 'missing' }),
    });
    expect(res.status).toBe(404);
  });
});
