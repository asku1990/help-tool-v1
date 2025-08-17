// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicle: { findFirst: vi.fn() },
    expense: { findMany: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  };
  return { default: mock };
});
vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { email: 'u@e' } })) }));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'k',
  checkRateLimit: vi.fn(() => ({ allowed: true })),
  rateLimitHeaders: (ms: number) => ({ 'Retry-After': String(Math.ceil(ms / 1000)) }),
}));

describe('expenses route basic behavior', () => {
  it('GET maps items and computes total', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      expense: { findMany: Mock; aggregate: Mock };
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.findMany.mockResolvedValueOnce([
      {
        id: 'e1',
        date: new Date('2024-01-01'),
        category: 'FUEL',
        amount: { toNumber: () => 1 },
        vendor: null,
        odometerKm: null,
        notes: null,
      },
    ]);
    prisma.expense.aggregate.mockResolvedValueOnce({ _sum: { amount: { toNumber: () => 1 } } });
    const req = new NextRequest('http://localhost/api/vehicles/v/expenses?limit=1');
    const res = await GET(req, { params: Promise.resolve({ vehicleId: 'v' }) });
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.expenses[0].id).toBe('e1');
    expect(json.data.expensesTotal).toBe(1);
  });

  it('POST validates and creates', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as {
      vehicle: { findFirst: Mock };
      expense: { create: Mock };
    };
    prisma.vehicle.findFirst.mockResolvedValueOnce({ id: 'v' });
    prisma.expense.create.mockResolvedValueOnce({ id: 'new' });
    const base = new Request('http://localhost/api/vehicles/v/expenses', {
      method: 'POST',
      body: JSON.stringify({ date: '2024-01-01', category: 'MAINTENANCE', amount: 3.5 }),
    });
    const req = new NextRequest(base);
    const res = await POST(req, { params: Promise.resolve({ vehicleId: 'v' }) });
    expect(res.status).toBe(201);
  });
});
