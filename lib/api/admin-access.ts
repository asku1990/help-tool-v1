import type { Session } from 'next-auth';
import type { UserType } from '@/generated/prisma';
import prisma from '@/lib/db';
import { forbidden, unauthorized } from '@/lib/api/response';
import { getSessionUserId } from '@/lib/api/vehicle-access';

export type CurrentUser = {
  id: string;
  userType: UserType;
};

export async function getCurrentUser(session: Session | null): Promise<CurrentUser | null> {
  const userId = await getSessionUserId(session);
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, userType: true },
  });

  return user ?? null;
}

export async function isAdmin(session: Session | null): Promise<boolean> {
  const user = await getCurrentUser(session);
  return user?.userType === 'ADMIN';
}

export async function requireAdmin(
  session: Session | null
): Promise<{ ok: true; user: CurrentUser } | { ok: false; response: Response }> {
  const user = await getCurrentUser(session);
  if (!user) return { ok: false, response: unauthorized() };
  if (user.userType !== 'ADMIN') return { ok: false, response: forbidden() };
  return { ok: true, user };
}
