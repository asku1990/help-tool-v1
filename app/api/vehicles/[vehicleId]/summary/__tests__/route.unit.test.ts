// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getSessionUserId: vi.fn(),
  getVehicleAccess: vi.fn(),
  hasPermission: vi.fn(),
  checkRateLimit: vi.fn(),
  fillUps: vi.fn(),
  expenses: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    fuelFillUp: { findMany: mocks.fillUps },
    expense: { findMany: mocks.expenses },
  },
}));
vi.mock('@/lib/api/vehicle-access', () => ({
  getSessionUserId: mocks.getSessionUserId,
  getVehicleAccess: mocks.getVehicleAccess,
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimitKey: () => 'summary-test',
  checkRateLimit: mocks.checkRateLimit,
  rateLimitHeaders: () => ({ 'Retry-After': '1' }),
}));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

const request = () =>
  GET(new NextRequest('http://localhost/api/vehicles/v/summary'), {
    params: Promise.resolve({ vehicleId: 'v' }),
  });

describe('vehicle summary API', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getSessionUserId.mockResolvedValue('u');
    mocks.getVehicleAccess.mockResolvedValue({ vehicle: { id: 'v' }, role: 'VIEWER' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue({ allowed: true });
    mocks.fillUps.mockResolvedValue([]);
    mocks.expenses.mockResolvedValue([]);
  });

  it('queries complete authorized history without pagination and disables response caching', async () => {
    mocks.fillUps.mockResolvedValue(
      Array.from({ length: 61 }, (_, i) => ({
        id: String(i),
        date: new Date('2026-11-01'),
        odometerKm: i * 100,
        liters: '5',
        totalCost: '10',
        isFull: true,
      }))
    );
    mocks.expenses.mockResolvedValue([
      { date: new Date('2026-11-01'), category: 'MAINTENANCE', amount: '20' },
    ]);
    const response = await request();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(body.data.segments).toHaveLength(60);
    expect(body.data.costPerKmLifetime).toBeCloseTo(620 / 6000);
    expect(mocks.fillUps).toHaveBeenCalledWith({
      where: { vehicleId: 'v' },
      select: {
        id: true,
        date: true,
        odometerKm: true,
        liters: true,
        totalCost: true,
        isFull: true,
      },
    });
    expect(mocks.expenses).toHaveBeenCalledWith({
      where: { vehicleId: 'v' },
      select: { date: true, category: true, amount: true },
    });
    expect(mocks.getVehicleAccess).toHaveBeenCalledWith('v', 'u');
    expect(mocks.hasPermission).toHaveBeenCalledWith('VIEWER', 'read');
  });

  it('rejects unauthenticated requests before reading history', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    expect((await request()).status).toBe(401);
    expect(mocks.fillUps).not.toHaveBeenCalled();
    expect(mocks.expenses).not.toHaveBeenCalled();
  });

  it('hides vehicles without access', async () => {
    mocks.getVehicleAccess.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(mocks.fillUps).not.toHaveBeenCalled();
  });

  it('requires read permission', async () => {
    mocks.hasPermission.mockReturnValue(false);
    expect((await request()).status).toBe(404);
    expect(mocks.fillUps).not.toHaveBeenCalled();
  });

  it('rate limits requests before authentication or database queries', async () => {
    mocks.checkRateLimit.mockReturnValue({ allowed: false, retryAfterMs: 1000 });
    const response = await request();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('1');
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.fillUps).not.toHaveBeenCalled();
  });

  it('returns a server error if history cannot be loaded', async () => {
    mocks.fillUps.mockRejectedValue(new Error('database unavailable'));
    expect((await request()).status).toBe(500);
  });
});
