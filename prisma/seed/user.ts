import prisma from '../../lib/db';
import { hashPassword } from '../../utils/hash';

export async function seedUsers() {
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@example.com',
        username: 'admin',
        passwordHash: await hashPassword('admin'), // Hashed password
      },
      {
        email: 'user@example.com',
        username: 'user',
        passwordHash: await hashPassword('user'), // Hashed password
      },
    ],
    skipDuplicates: true,
  });
}
