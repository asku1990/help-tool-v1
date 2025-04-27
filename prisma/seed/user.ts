import prisma from '../../lib/db';
import { hashPassword } from '../../utils/hash';

export async function seedUsers() {
  await prisma.user.createMany({
    data: [
      {
        email: process.env.ADMIN_EMAIL!,
        username: process.env.ADMIN_USERNAME!,
        passwordHash: await hashPassword(process.env.ADMIN_PASSWORD!),
        userType: 'ADMIN',
      },
      {
        email: process.env.USER_EMAIL!,
        username: process.env.USER_USERNAME!,
        passwordHash: await hashPassword(process.env.USER_PASSWORD!),
        userType: 'REGULAR',
      },
      {
        email: process.env.GUEST_EMAIL!,
        username: process.env.GUEST_USERNAME!,
        passwordHash: await hashPassword(process.env.GUEST_PASSWORD!),
        userType: 'GUEST',
      },
    ],
    skipDuplicates: true,
  });
}
