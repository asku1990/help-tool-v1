// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DELETE as deleteExpense } from '@/app/api/vehicles/[vehicleId]/expenses/[expenseId]/attachments/[attachmentId]/route';
import { DELETE as deleteFillUp } from '@/app/api/vehicles/[vehicleId]/fillups/[fillUpId]/attachments/[attachmentId]/route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  find: vi.fn(),
  removeMetadata: vi.fn(),
  storage: vi.fn(),
  removeObject: vi.fn(),
  limit: vi.fn(),
  log: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    attachment: { findFirst: mocks.find, deleteMany: mocks.removeMetadata },
  },
}));
vi.mock('../storage', () => ({ createAttachmentStorage: mocks.storage }));
vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: mocks.limit,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.log } }));

type Ids = { vehicleId: string; parentId: string; attachmentId: string };
const defaults: Ids = { vehicleId: 'car', parentId: 'parent', attachmentId: 'attachment' };
const objectKey = 'attachments/private-key';

describe.each([
  {
    type: 'expense',
    remove: ({ vehicleId, parentId, attachmentId }: Ids) =>
      deleteExpense(new Request('http://localhost/attachment', { method: 'DELETE' }), {
        params: Promise.resolve({ vehicleId, expenseId: parentId, attachmentId }),
      }),
  },
  {
    type: 'fillup',
    remove: ({ vehicleId, parentId, attachmentId }: Ids) =>
      deleteFillUp(new Request('http://localhost/attachment', { method: 'DELETE' }), {
        params: Promise.resolve({ vehicleId, fillUpId: parentId, attachmentId }),
      }),
  },
])('$type attachment deletion', ({ type, remove }) => {
  const expectedWhere = {
    id: 'attachment',
    ...(type === 'expense'
      ? { expenseId: 'parent', expense: { vehicleId: 'car' } }
      : { fuelFillUpId: 'parent', fuelFillUp: { vehicleId: 'car' } }),
  };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role: 'OWNER' });
    mocks.limit.mockReturnValue({ allowed: true });
    mocks.storage.mockReturnValue({ delete: mocks.removeObject });
    mocks.removeObject.mockResolvedValue(undefined);
    mocks.removeMetadata.mockResolvedValue({ count: 1 });
    mocks.find.mockImplementation(async ({ where }: { where: unknown }) =>
      JSON.stringify(where) === JSON.stringify(expectedWhere) ? { objectKey } : null
    );
  });

  it.each(['OWNER', 'EDITOR'])('allows %s to delete storage before scoped metadata', async role => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const response = await remove(defaults);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ data: { id: 'attachment' }, error: null });
    expect(mocks.find).toHaveBeenCalledWith({
      where: expectedWhere,
      select: { objectKey: true },
    });
    expect(mocks.removeObject).toHaveBeenCalledWith(objectKey);
    expect(mocks.removeMetadata).toHaveBeenCalledWith({ where: expectedWhere });
    expect(mocks.removeObject.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.removeMetadata.mock.invocationCallOrder[0]
    );
  });

  it('rejects unauthenticated requests', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await remove(defaults);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it.each([null, { vehicle: { id: 'car' }, role: 'VIEWER' }])(
    'rejects non-members and viewers before reading metadata: %j',
    async access => {
      mocks.access.mockResolvedValue(access);
      expect((await remove(defaults)).status).toBe(404);
      expect(mocks.find).not.toHaveBeenCalled();
      expect(mocks.storage).not.toHaveBeenCalled();
    }
  );

  it.each([
    { parentId: 'wrong-parent' },
    { attachmentId: 'foreign-attachment' },
    { vehicleId: 'another-authorized-car' },
  ])('rejects mismatched vehicle, parent, or attachment IDs: %j', async ids => {
    if (ids.vehicleId) {
      mocks.access.mockResolvedValue({ vehicle: { id: ids.vehicleId }, role: 'OWNER' });
    }
    expect((await remove({ ...defaults, ...ids })).status).toBe(404);
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.removeMetadata).not.toHaveBeenCalled();
  });

  it('preserves metadata on storage failure and does not expose private errors', async () => {
    mocks.removeObject.mockRejectedValue(new Error(`Storage failure: ${objectKey}`));
    const response = await remove(defaults);
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.text()).not.toContain(objectKey);
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(objectKey);
    expect(mocks.removeMetadata).not.toHaveBeenCalled();
  });

  it('can retry after storage succeeds but metadata deletion fails', async () => {
    mocks.removeMetadata.mockRejectedValueOnce(new Error('Database unavailable'));
    expect((await remove(defaults)).status).toBe(500);
    // R2 DeleteObject succeeds even when the first request already removed the object.
    expect((await remove(defaults)).status).toBe(200);
    expect(mocks.removeObject).toHaveBeenCalledTimes(2);
    expect(mocks.removeMetadata).toHaveBeenCalledTimes(2);
  });

  it('returns an error without contacting storage when lookup fails', async () => {
    mocks.find.mockRejectedValue(new Error('Database unavailable'));
    expect((await remove(defaults)).status).toBe(500);
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('rate limits before authentication and provides a retry header', async () => {
    mocks.limit.mockReturnValue({ allowed: false, retryAfterMs: 1500 });
    const response = await remove(defaults);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });
});
