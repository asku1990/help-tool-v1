// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { auth } from '@/auth';
import { GET } from '@/app/api/auth/[...nextauth]/route';

vi.mock('@/lib/db', () => ({ default: { user: { findUnique: vi.fn() } } }));
vi.mock('next-auth', () => ({
  default: () => ({
    auth: async () => null,
    handlers: { GET: async () => Response.json({ standardAuth: true }) },
  }),
}));

const sessionRequest = new NextRequest('http://127.0.0.1/api/auth/session');
const testUser = {
  id: 'test-user',
  email: 'browser-test@example.test',
  username: 'browser-test',
  userType: 'REGULAR',
  passwordHash: '',
  createdAt: new Date(0),
  updatedAt: new Date(0),
} as const;

describe('local automatic sign-in', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.mocked(prisma.user.findUnique).mockClear();
  });

  afterEach(() => vi.unstubAllEnvs());

  it.each([
    { mode: 'development', enabled: '' },
    { mode: 'production', enabled: '1' },
  ])(
    'uses standard auth in $mode when the local session is disabled',
    async ({ mode, enabled }) => {
      vi.stubEnv('NODE_ENV', mode);
      vi.stubEnv('LOCAL_AUTO_SIGN_IN', enabled);
      expect(await auth()).toBeNull();
      expect(await (await GET(sessionRequest)).json()).toEqual({ standardAuth: true });
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    }
  );

  it.each(['REGULAR', 'ADMIN'] as const)(
    'provides the same fixed %s user to the browser and server',
    async userType => {
      vi.stubEnv('LOCAL_AUTO_SIGN_IN', '1');
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ ...testUser, userType });
      const response = await GET(sessionRequest);
      const browser = await response.json();
      expect(browser).toMatchObject({
        user: {
          id: testUser.id,
          email: testUser.email,
          name: testUser.username,
        },
      });
      expect((await auth())?.user).toEqual(browser.user);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    }
  );

  it('does not auto-sign in when the fixed test user is missing', async () => {
    vi.stubEnv('LOCAL_AUTO_SIGN_IN', '1');
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    expect(await (await GET(sessionRequest)).json()).toBeNull();
  });
});
