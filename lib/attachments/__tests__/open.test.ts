// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as openExpense } from '@/app/api/vehicles/[vehicleId]/expenses/[expenseId]/attachments/[attachmentId]/open/route';
import { GET as openFillUp } from '@/app/api/vehicles/[vehicleId]/fillups/[fillUpId]/attachments/[attachmentId]/open/route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  find: vi.fn(),
  storage: vi.fn(),
  sign: vi.fn(),
  limit: vi.fn(),
  log: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    attachment: { findFirst: mocks.find },
  },
}));
vi.mock('../storage', () => ({ createAttachmentStorage: mocks.storage }));
vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: mocks.limit,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.log } }));

type Ids = { vehicleId: string; parentId: string; attachmentId: string };
type Lookup = {
  where: {
    id: string;
    expenseId?: string;
    expense?: { vehicleId: string };
    fuelFillUpId?: string;
    fuelFillUp?: { vehicleId: string };
  };
};
const defaults: Ids = { vehicleId: 'car', parentId: 'parent', attachmentId: 'attachment' };
const metadata = {
  objectKey: 'attachments/private-key',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
};
const signedUrl =
  'https://staging.r2.cloudflarestorage.com/bucket/attachments/private-key?signature=secret';

describe.each([
  {
    type: 'expense',
    get: ({ vehicleId, parentId, attachmentId }: Ids) =>
      openExpense(new Request('http://localhost/open'), {
        params: Promise.resolve({ vehicleId, expenseId: parentId, attachmentId }),
      }),
  },
  {
    type: 'fillup',
    get: ({ vehicleId, parentId, attachmentId }: Ids) =>
      openFillUp(new Request('http://localhost/open'), {
        params: Promise.resolve({ vehicleId, fillUpId: parentId, attachmentId }),
      }),
  },
])('$type attachment Open', ({ type, get }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role: 'OWNER' });
    mocks.limit.mockReturnValue({ allowed: true });
    mocks.storage.mockReturnValue({ getOpenUrl: mocks.sign });
    mocks.sign.mockResolvedValue(signedUrl);
    mocks.find.mockImplementation(async ({ where }: Lookup) => {
      const matchesParent =
        type === 'expense'
          ? where.expenseId === 'parent' && where.expense?.vehicleId === 'car'
          : where.fuelFillUpId === 'parent' && where.fuelFillUp?.vehicleId === 'car';
      return where.id === 'attachment' && matchesParent ? metadata : null;
    });
  });

  it.each(['OWNER', 'EDITOR', 'VIEWER'])('allows %s to open a readable attachment', async role => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const response = await get(defaults);
    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(signedUrl);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(await response.text()).toBe('');
    expect(mocks.sign).toHaveBeenCalledWith(
      metadata.objectKey,
      metadata.filename,
      metadata.contentType
    );
    expect(mocks.find).toHaveBeenCalledWith({
      where: {
        id: 'attachment',
        ...(type === 'expense'
          ? { expenseId: 'parent', expense: { vehicleId: 'car' } }
          : { fuelFillUpId: 'parent', fuelFillUp: { vehicleId: 'car' } }),
      },
      select: { objectKey: true, filename: true, contentType: true },
    });
  });

  it('rejects unauthenticated requests before looking up or signing an object', async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await get(defaults);
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('rejects callers without membership in the requested vehicle', async () => {
    mocks.access.mockResolvedValue(null);
    expect((await get(defaults)).status).toBe(404);
    expect(mocks.access).toHaveBeenCalledWith({
      where: { vehicleId: 'car', userId: 'user' },
      include: { vehicle: true },
    });
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it.each([
    { parentId: 'wrong-parent', attachmentId: 'attachment' },
    { parentId: 'parent', attachmentId: 'foreign-attachment' },
  ])('rejects mismatched or missing parent/attachment IDs: %j', async ids => {
    const response = await get({ ...defaults, ...ids });
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('cannot sign an attachment through another authorized vehicle', async () => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'another-authorized-car' }, role: 'OWNER' });
    expect((await get({ ...defaults, vehicleId: 'another-authorized-car' })).status).toBe(404);
    expect(mocks.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining(
          type === 'expense'
            ? { expense: { vehicleId: 'another-authorized-car' } }
            : { fuelFillUp: { vehicleId: 'another-authorized-car' } }
        ),
      })
    );
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it.each(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])(
    'opens the supported verified content type %s',
    async contentType => {
      mocks.find.mockResolvedValue({ ...metadata, contentType });
      expect((await get(defaults)).status).toBe(302);
      expect(mocks.sign).toHaveBeenCalledWith(metadata.objectKey, metadata.filename, contentType);
    }
  );

  it('does not sign unsupported inline content such as HTML or SVG', async () => {
    for (const contentType of ['text/html', 'image/svg+xml', 'application/octet-stream']) {
      mocks.find.mockResolvedValue({ ...metadata, contentType });
      expect((await get(defaults)).status).toBe(404);
    }
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it('rate limits before signing and includes a retry header', async () => {
    mocks.limit.mockReturnValue({ allowed: false, retryAfterMs: 1500 });
    const response = await get(defaults);
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('2');
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.sign).not.toHaveBeenCalled();
  });

  it('does not expose signing failures or signed URLs in error responses or logs', async () => {
    mocks.sign.mockRejectedValue(new Error(`Could not sign ${signedUrl}`));
    const response = await get(defaults);
    expect(response.status).toBe(500);
    expect(response.headers.get('location')).toBeNull();
    const body: unknown = await response.json();
    expect(body).toMatchObject({
      error: { message: 'Could not open the attachment. Try Open again.' },
    });
    expect(JSON.stringify(body)).not.toContain('signature=secret');
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain('signature=secret');
  });

  it('returns a safe error when metadata lookup fails', async () => {
    mocks.find.mockRejectedValue(new Error('Database unavailable'));
    expect((await get(defaults)).status).toBe(500);
    expect(mocks.sign).not.toHaveBeenCalled();
  });
});
