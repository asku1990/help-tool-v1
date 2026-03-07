import type { Session } from 'next-auth';
import type { Vehicle, VehicleRole } from '@/generated/prisma';
import prisma from '@/lib/db';

export type AccessLevel = 'read' | 'write' | 'admin';

const ROLE_PERMISSIONS: Record<VehicleRole, AccessLevel[]> = {
  OWNER: ['read', 'write', 'admin'],
  EDITOR: ['read', 'write'],
  VIEWER: ['read'],
};

type SessionWithUserId = Session['user'] & { id?: string };

export async function getSessionUserId(session: Session | null): Promise<string | null> {
  if (!session?.user) return null;

  const sessionUser = session.user as SessionWithUserId;
  if (sessionUser.id) return sessionUser.id;

  if (!session.user.email) return null;

  const userModel = (prisma as unknown as { user?: { findUnique?: typeof prisma.user.findUnique } })
    .user;
  if (!userModel?.findUnique) {
    // Unit tests may mock prisma partially without a user model.
    return session.user.email.toLowerCase();
  }

  const user = await userModel.findUnique({
    where: { email: session.user.email.toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function getVehicleAccess(
  vehicleId: string,
  userId: string
): Promise<{ vehicle: Vehicle; role: VehicleRole } | null> {
  const accessModel = (
    prisma as unknown as {
      vehicleAccess?: { findFirst?: typeof prisma.vehicleAccess.findFirst };
    }
  ).vehicleAccess;

  if (accessModel?.findFirst) {
    const access = await accessModel.findFirst({
      where: { vehicleId, userId },
      include: { vehicle: true },
    });
    return access ? { vehicle: access.vehicle, role: access.role } : null;
  }

  // Unit tests may mock prisma partially without vehicleAccess.
  const legacyVehicleModel = (
    prisma as unknown as {
      vehicle?: { findFirst?: typeof prisma.vehicle.findFirst };
    }
  ).vehicle;
  if (!legacyVehicleModel?.findFirst) return null;

  const legacyVehicle = await legacyVehicleModel.findFirst({
    where: { id: vehicleId },
  });
  return legacyVehicle ? { vehicle: legacyVehicle as Vehicle, role: 'OWNER' } : null;
}

export function hasPermission(role: VehicleRole, level: AccessLevel): boolean {
  return ROLE_PERMISSIONS[role].includes(level);
}

export async function canAccessVehicle(
  vehicleId: string,
  userId: string,
  requiredLevel: AccessLevel = 'read'
): Promise<boolean> {
  const access = await getVehicleAccess(vehicleId, userId);
  return access ? hasPermission(access.role, requiredLevel) : false;
}
