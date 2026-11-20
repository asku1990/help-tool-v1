import type { Session } from 'next-auth';
import prisma from '@/lib/db';

export const localTestEmail = 'browser-test@example.test';

export function localAutoSignInEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.LOCAL_AUTO_SIGN_IN === '1';
}

export async function getLocalTestSession(): Promise<Session | null> {
  if (!localAutoSignInEnabled()) return null;

  const user = await prisma.user.findUnique({
    where: { email: localTestEmail },
    select: { id: true, email: true, username: true },
  });
  if (!user) return null;

  const sessionUser = { id: user.id, email: user.email, name: user.username };
  return { user: sessionUser, expires: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
}
