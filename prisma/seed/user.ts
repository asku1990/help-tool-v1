import prisma from '../../lib/db';
import { hashPassword } from '../../utils/hash';
import { UserType } from '../../generated/prisma';

export async function seedUsers() {
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
    await prisma.user.createMany({
      data: [
        {
          email: process.env.ADMIN_EMAIL,
          username: process.env.ADMIN_USERNAME,
          passwordHash: await hashPassword(process.env.ADMIN_PASSWORD),
          userType: 'ADMIN' as UserType,
        },
      ],
      skipDuplicates: true,
    });
  }
}
