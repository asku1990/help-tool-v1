// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  findMany: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    fuelFillUp: { findMany: mocks.findMany },
  },
}));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'fillups',
  checkRateLimit: () => ({ allowed: true }),
  rateLimitHeaders: () => ({}),
}));

describe('Fill-up list write capability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.findMany.mockResolvedValue([]);
  });

  it.each([
    { role: 'OWNER', canWrite: true },
    { role: 'EDITOR', canWrite: true },
    { role: 'VIEWER', canWrite: false },
  ])('reports canWrite=$canWrite for $role', async ({ role, canWrite }) => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const response = await GET(new NextRequest('http://localhost/api/vehicles/car/fillups'), {
      params: Promise.resolve({ vehicleId: 'car' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { canWrite } });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { vehicleId: 'car' } })
    );
  });
});
