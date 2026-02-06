// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { canAccessVehicle, hasPermission } from '../vehicle-access';

vi.mock('@/lib/db', () => {
  const mock = {
    vehicleAccess: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  };
  return { default: mock };
});

describe('vehicle-access helper', () => {
  it('hasPermission follows role matrix', () => {
    expect(hasPermission('OWNER', 'read')).toBe(true);
    expect(hasPermission('OWNER', 'write')).toBe(true);
    expect(hasPermission('OWNER', 'admin')).toBe(true);

    expect(hasPermission('EDITOR', 'read')).toBe(true);
    expect(hasPermission('EDITOR', 'write')).toBe(true);
    expect(hasPermission('EDITOR', 'admin')).toBe(false);

    expect(hasPermission('VIEWER', 'read')).toBe(true);
    expect(hasPermission('VIEWER', 'write')).toBe(false);
    expect(hasPermission('VIEWER', 'admin')).toBe(false);
  });

  it('canAccessVehicle returns false when no membership exists', async () => {
    const prisma = (await import('@/lib/db')).default;
    vi.mocked(prisma.vehicleAccess.findFirst).mockResolvedValueOnce(null);

    const allowed = await canAccessVehicle('vehicle-1', 'user-1', 'read');
    expect(allowed).toBe(false);
  });
});
