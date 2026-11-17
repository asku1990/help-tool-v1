// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findMany: vi.fn(),
  aggregate: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    expense: { findMany: mocks.findMany, aggregate: mocks.aggregate },
  },
}));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'expenses',
  checkRateLimit: () => ({ allowed: true }),
  rateLimitHeaders: () => ({}),
}));

describe('Expense list write capability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.findMany.mockResolvedValue([]);
    mocks.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
  });

  it.each([
    { role: 'OWNER', canWrite: true },
    { role: 'EDITOR', canWrite: true },
    { role: 'VIEWER', canWrite: false },
  ])('reports canWrite=$canWrite for $role', async ({ role, canWrite }) => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const response = await GET(new NextRequest('http://localhost/api/vehicles/car/expenses'), {
      params: Promise.resolve({ vehicleId: 'car' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { canWrite } });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vehicleId: 'car' } })
    );
  });
});
