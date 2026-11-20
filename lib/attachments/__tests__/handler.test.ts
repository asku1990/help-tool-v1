// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GET as getVehicle,
  POST as postVehicle,
} from '@/app/api/vehicles/[vehicleId]/attachments/route';
import {
  GET as getExpenses,
  POST as postExpenses,
} from '@/app/api/vehicles/[vehicleId]/expenses/[expenseId]/attachments/route';
import {
  GET as getFillUps,
  POST as postFillUps,
} from '@/app/api/vehicles/[vehicleId]/fillups/[fillUpId]/attachments/route';
import { AttachmentError } from '../validation';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  access: vi.fn(),
  expense: vi.fn(),
  fillup: vi.fn(),
  list: vi.fn(),
  upload: vi.fn(),
  storage: vi.fn(),
  limit: vi.fn(),
  log: vi.fn(),
}));

vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/db', () => ({
  default: {
    vehicleAccess: { findFirst: mocks.access },
    expense: { findFirst: mocks.expense },
    fuelFillUp: { findFirst: mocks.fillup },
  },
}));
vi.mock('../upload', async importOriginal => ({
  ...(await importOriginal<typeof import('../upload')>()),
  listAttachments: mocks.list,
  uploadAttachment: mocks.upload,
}));
vi.mock('../storage', () => ({ createAttachmentStorage: mocks.storage }));
vi.mock('@/lib/api/rate-limit', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/api/rate-limit')>()),
  checkRateLimit: mocks.limit,
}));
vi.mock('@/lib/logger', () => ({ logger: { error: mocks.log } }));

const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n');
const item = {
  id: 'attachment',
  filename: 'receipt.pdf',
  contentType: 'application/pdf',
  sizeBytes: pdf.byteLength,
  createdAtUtc: '2026-11-16T00:00:00.000Z',
  updatedAtUtc: '2026-11-16T00:00:00.000Z',
};

function uploadRequest(bytes: Uint8Array = pdf, type = 'application/pdf', headers?: HeadersInit) {
  const form = new FormData();
  form.append('file', new File([bytes], 'receipt.pdf', { type }));
  return new Request('http://localhost/api/attachments', { method: 'POST', body: form, headers });
}

describe.each([
  {
    type: 'vehicle',
    get: (req: Request) => getVehicle(req, { params: Promise.resolve({ vehicleId: 'car' }) }),
    post: (req: Request) => postVehicle(req, { params: Promise.resolve({ vehicleId: 'car' }) }),
    parent: undefined,
  },
  {
    type: 'expense',
    get: (req: Request) =>
      getExpenses(req, { params: Promise.resolve({ vehicleId: 'car', expenseId: 'parent' }) }),
    post: (req: Request) =>
      postExpenses(req, { params: Promise.resolve({ vehicleId: 'car', expenseId: 'parent' }) }),
    parent: mocks.expense,
  },
  {
    type: 'fillup',
    get: (req: Request) =>
      getFillUps(req, { params: Promise.resolve({ vehicleId: 'car', fillUpId: 'parent' }) }),
    post: (req: Request) =>
      postFillUps(req, { params: Promise.resolve({ vehicleId: 'car', fillUpId: 'parent' }) }),
    parent: mocks.fillup,
  },
])('$type attachment routes', ({ type, get, post, parent }) => {
  const target = type === 'vehicle' ? { type } : { type, id: 'parent' };
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: 'user' } });
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role: 'OWNER' });
    parent?.mockResolvedValue({ id: 'parent' });
    mocks.limit.mockReturnValue({ allowed: true });
    mocks.storage.mockReturnValue({ put: vi.fn(), delete: vi.fn() });
    mocks.list.mockResolvedValue({ attachments: [item], maxAttachments: 10, remainingCapacity: 9 });
    mocks.upload.mockResolvedValue(item);
  });

  it('rejects unauthenticated reads and uploads before parsing or storage', async () => {
    mocks.auth.mockResolvedValue(null);
    expect((await get(new Request('http://localhost/api/attachments'))).status).toBe(401);
    const req = uploadRequest();
    expect((await post(req)).status).toBe(401);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.access).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'EDITOR', 'VIEWER'])('allows %s to list safe metadata', async role => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const res = await get(new Request('http://localhost/api/attachments'));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({
      data: {
        attachments: [item],
        maxAttachments: 10,
        remainingCapacity: 9,
        canUpload: role !== 'VIEWER',
      },
      error: null,
    });
    expect(mocks.access).toHaveBeenCalledWith({
      where: { vehicleId: 'car', userId: 'user' },
      include: { vehicle: true },
    });
    if (parent) {
      expect(parent).toHaveBeenCalledWith({
        where: { id: 'parent', vehicleId: 'car' },
        select: { id: true },
      });
    }
    expect(mocks.list).toHaveBeenCalledWith(expect.any(Object), 'car', target);
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it.each(['OWNER', 'EDITOR'])('allows %s to upload validated binary content', async role => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role });
    const res = await post(
      uploadRequest(pdf, 'application/pdf', {
        origin: 'http://localhost',
        'sec-fetch-site': 'same-origin',
      })
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: item, error: null });
    expect(mocks.upload).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      'car',
      target,
      { filename: 'receipt.pdf', contentType: 'application/pdf', bytes: pdf }
    );
  });

  it('rejects viewer uploads before reading bytes', async () => {
    mocks.access.mockResolvedValue({ vehicle: { id: 'car' }, role: 'VIEWER' });
    const req = uploadRequest();
    expect((await post(req)).status).toBe(404);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('rejects requests without vehicle membership', async () => {
    mocks.access.mockResolvedValue(null);
    expect((await get(new Request('http://localhost/api/attachments'))).status).toBe(404);
    expect((await post(uploadRequest())).status).toBe(404);
    expect(mocks.expense).not.toHaveBeenCalled();
    expect(mocks.fillup).not.toHaveBeenCalled();
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  if (parent) {
    it('rejects missing or cross-car nested parents', async () => {
      parent.mockResolvedValue(null);
      expect((await get(new Request('http://localhost/api/attachments'))).status).toBe(404);
      const req = uploadRequest();
      expect((await post(req)).status).toBe(404);
      expect(req.bodyUsed).toBe(false);
      expect(mocks.list).not.toHaveBeenCalled();
      expect(mocks.storage).not.toHaveBeenCalled();
    });
  }

  it.each([
    ['origin', 'https://other.example.test'],
    ['sec-fetch-site', 'cross-site'],
    ['sec-fetch-site', 'same-site'],
    ['origin', 'null'],
  ])('rejects cross-origin browser uploads before parsing: %s=%s', async (header, value) => {
    const req = uploadRequest(pdf, 'application/pdf', { [header]: value });
    expect((await post(req)).status).toBe(403);
    expect(req.bodyUsed).toBe(false);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('rejects misleading file content before storage', async () => {
    const res = await post(uploadRequest(new TextEncoder().encode('not a PDF')));
    expect(res.status).toBe(415);
    expect(mocks.storage).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('rejects oversized files before storage', async () => {
    const res = await post(uploadRequest(new Uint8Array(4_000_001)));
    expect(res.status).toBe(413);
    expect(mocks.storage).not.toHaveBeenCalled();
  });

  it('returns a useful capacity error', async () => {
    mocks.upload.mockRejectedValue(
      new AttachmentError('ATTACHMENT_LIMIT', 'Ten files maximum.', 409)
    );
    const res = await post(uploadRequest());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'ATTACHMENT_LIMIT' } });
  });

  it('returns a safe retry message for storage/database failures', async () => {
    mocks.upload.mockRejectedValue(new Error('Internal storage details'));
    const res = await post(uploadRequest());
    expect(res.status).toBe(500);
    const body: unknown = await res.json();
    expect(body).toMatchObject({
      error: {
        message: 'Attachments are temporarily unavailable. Refresh the list before retrying.',
      },
    });
    expect(JSON.stringify(body)).not.toContain('Internal storage details');
  });

  it('enforces the existing rate limiter before parsing or storage', async () => {
    mocks.limit.mockReturnValue({ allowed: false, retryAfterMs: 1500 });
    const req = uploadRequest();
    const res = await post(req);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('2');
    expect(req.bodyUsed).toBe(false);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.storage).not.toHaveBeenCalled();
  });
});
