// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PATCH as renameVehicle } from '@/app/api/vehicles/[vehicleId]/attachments/[attachmentId]/route';
import { PATCH as renameExpense } from '@/app/api/vehicles/[vehicleId]/expenses/[expenseId]/attachments/[attachmentId]/route';
import { PATCH as renameFillUp } from '@/app/api/vehicles/[vehicleId]/fillups/[fillUpId]/attachments/[attachmentId]/route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  find: vi.fn(),
  update: vi.fn(),
  limit: vi.fn(),
  log: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    attachment: { findFirst: mocks.find, updateMany: mocks.update },
  },
}));
vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: mocks.limit,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.log } }));

type Ids = { vehicleId: string; parentId: string; attachmentId: string };
const defaults: Ids = { vehicleId: 'car', parentId: 'parent', attachmentId: 'attachment' };

describe.each([
  {
    type: 'vehicle',
    patch: (request: Request, { vehicleId, attachmentId }: Ids) =>
      renameVehicle(request, {
        params: Promise.resolve({ vehicleId, attachmentId }),
      }),
  },
  {
    type: 'expense',
    patch: (request: Request, { vehicleId, parentId, attachmentId }: Ids) =>
      renameExpense(request, {
        params: Promise.resolve({ vehicleId, expenseId: parentId, attachmentId }),
      }),
  },
  {
    type: 'fillup',
    patch: (request: Request, { vehicleId, parentId, attachmentId }: Ids) =>
      renameFillUp(request, {
        params: Promise.resolve({ vehicleId, fillUpId: parentId, attachmentId }),
      }),
  },
])('$type attachment rename', ({ type, patch }) => {
  const where = {
    id: 'attachment',
    ...(type === 'vehicle'
      ? { vehicleId: 'car' }
      : type === 'expense'
        ? { expenseId: 'parent', expense: { vehicleId: 'car' } }
        : { fuelFillUpId: 'parent', fuelFillUp: { vehicleId: 'car' } }),
  };
  function rename(body: unknown = { name: ' Service receipt ' }, ids: Ids = defaults) {
    return patch(
      new Request('http://localhost/attachment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      ids
    );
  }
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role: 'OWNER' });
    mocks.limit.mockReturnValue({ allowed: true });
    mocks.find.mockImplementation(async (query: { where: unknown }) =>
      JSON.stringify(query.where) === JSON.stringify(where) ? { filename: 'receipt.pdf' } : null
    );
    mocks.update.mockResolvedValue({ count: 1 });
  });

  it.each(['OWNER', 'EDITOR'])('allows %s to update only the filename', async role => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const response = await rename();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      data: { id: 'attachment', filename: 'Service receipt.pdf' },
      error: null,
    });
    expect(mocks.find).toHaveBeenCalledWith({ where, select: { filename: true } });
    expect(mocks.update).toHaveBeenCalledWith({
      where,
      data: { filename: 'Service receipt.pdf' },
    });
  });

  it('preserves the original extension exactly, including its case', async () => {
    mocks.find.mockResolvedValue({ filename: 'photo.JPEG' });
    expect((await rename({ name: 'Tyres' })).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where,
      data: { filename: 'Tyres.JPEG' },
    });
  });

  it('renames an extensionless filename without appending its final character', async () => {
    mocks.find.mockResolvedValue({ filename: 'pdf' });
    const response = await rename({ name: 'Receipt' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: { filename: 'Receipt' } });
    expect(mocks.update).toHaveBeenCalledWith({
      where,
      data: { filename: 'Receipt' },
    });
  });

  it.each([
    {},
    null,
    { name: 123 },
    { name: '' },
    { name: '  ' },
    { name: 'folder/receipt' },
    { name: 'folder\\receipt' },
    { name: 'receipt\nname' },
    { name: 'receipt\u007fname' },
    { name: 'receipt\u0080name' },
    { name: 'receipt\u0085name' },
    { name: 'receipt\u009fname' },
    { name: 'x'.repeat(252) },
    { name: 'Receipt', extension: '.png' },
  ])('rejects invalid names or unsupported fields: %j', async body => {
    const response = await rename(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_FILENAME' } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await patch(
      new Request('http://localhost/attachment', { method: 'PATCH', body: '{' }),
      defaults
    );
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('accepts Unicode names and the maximum full filename length', async () => {
    expect((await rename({ name: 'Huoltokirja – öljynvaihto' })).status).toBe(200);
    expect((await rename({ name: 'x'.repeat(251) })).status).toBe(200);
  });

  it('rejects unauthenticated requests before reading metadata', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await rename()).status).toBe(401);
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each([null, { vehicle: { id: 'car' }, role: 'VIEWER' }])(
    'rejects non-members and viewers: %j',
    async access => {
      mocks.access.mockResolvedValue(access);
      expect((await rename()).status).toBe(404);
      expect(mocks.find).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it.each([
    ...(type === 'vehicle' ? [] : [{ parentId: 'wrong-parent' }]),
    { attachmentId: 'foreign-attachment' },
    { vehicleId: 'another-authorized-car' },
  ])('rejects mismatched vehicle, parent, or attachment IDs: %j', async ids => {
    if (ids.vehicleId) {
      mocks.access.mockResolvedValue({ vehicle: { id: ids.vehicleId }, role: 'OWNER' });
    }
    expect((await rename({ name: 'Receipt' }, { ...defaults, ...ids })).status).toBe(404);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('reports a concurrent deletion rather than pretending the rename succeeded', async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await rename()).status).toBe(404);
  });

  it('returns a safe error on database failure', async () => {
    mocks.update.mockRejectedValue(new Error('Private database connection details'));
    const response = await rename();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('Private database');
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain('Private database');
  });

  it('rate limits before authentication and includes a retry header', async () => {
    mocks.limit.mockReturnValue({ allowed: false, retryAfterMs: 1500 });
    const response = await rename();
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
