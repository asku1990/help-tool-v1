// @vitest-environment node
import { describe, it, expect, vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/db', () => {
  const mock = {
    user: { findUnique: vi.fn(), findMany: vi.fn() },
  };
  return { default: mock };
});

vi.mock('@/auth', () => ({ auth: vi.fn(async () => ({ user: { id: 'admin-1', email: 'a@e' } })) }));

type PrismaMock = {
  user: { findUnique: Mock; findMany: Mock };
};

describe('GET /api/admin/users', () => {
  it('returns 401 when unauthenticated', async () => {
    const { auth } = await import('@/auth');
    (auth as unknown as Mock).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/admin/users');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not admin', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'REGULAR' });

    const req = new NextRequest('http://localhost/api/admin/users');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns users for admin', async () => {
    const prisma = (await import('@/lib/db')).default as unknown as PrismaMock;
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'u1', userType: 'ADMIN' });
    prisma.user.findMany.mockResolvedValueOnce([
      {
        id: 'u1',
        email: 'admin@example.com',
        username: 'admin',
        userType: 'ADMIN',
        createdAt: new Date(),
      },
    ]);

    const req = new NextRequest('http://localhost/api/admin/users');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.users).toHaveLength(1);
    expect(body.data.users[0].email).toBe('admin@example.com');
  });
});
