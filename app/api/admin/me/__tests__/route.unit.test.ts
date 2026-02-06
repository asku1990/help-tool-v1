// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    user: { findUnique: vi.fn() },
  };
  return { default: mock };
});

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'u1', email: 'u@e' } })) }));

describe('GET /api/admin/me', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/admin/me');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns isAdmin=true for admins', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as { user: { findUnique: Mock } };
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });

    const req = new NextRequest('http://localhost/api/admin/me');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.isAdmin).toBe(true);
  });
});
