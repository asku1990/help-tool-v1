// @vitest-environment node
import { NextRequest } from 'next/server';
import { expect, it, vi } from 'vitest';
import { PUT } from '../route';

const db = vi.hoisted(() => ({
  vehicleAccess: { findFirst: vi.fn() },
  vehicle: { updateMany: vi.fn() },
}));
vi.mock('@/lib/db', () => ({ default: db }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'u1' } }) }));

function setArchived(archived: boolean) {
  const request = new NextRequest('http://localhost/api/vehicles/v1/archive', {
    method: 'PUT',
    body: JSON.stringify({ archived }),
  });
  return PUT(request, { params: Promise.resolve({ vehicleId: 'v1' }) });
}

it.each(['EDITOR', 'VIEWER', null])('denies archive changes for %s', async role => {
  db.vehicleAccess.findFirst.mockResolvedValueOnce(role && { role, vehicle: { id: 'v1' } });
  expect((await setArchived(true)).status).toBe(404);
  expect(db.vehicle.updateMany).not.toHaveBeenCalled();
});

it.each([true, false])('owner sets archived=%s only when the state changes', async archived => {
  db.vehicleAccess.findFirst.mockResolvedValueOnce({ role: 'OWNER', vehicle: { id: 'v1' } });
  expect((await setArchived(archived)).status).toBe(200);
  expect(db.vehicle.updateMany).toHaveBeenLastCalledWith({
    where: {
      id: 'v1',
      access: { some: { userId: 'u1', role: 'OWNER' } },
      archivedAtUtc: archived ? null : { not: null },
    },
    data: { archivedAtUtc: archived ? expect.any(Date) : null },
  });
});
