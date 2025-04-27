import prisma from '../../lib/db';

export async function seedUsers() {
  await prisma.user.createMany({
    data: [
      {
        email: 'admin@example.com',
        username: 'admin',
        passwordHash: 'admin', // Replace with a real hash in production
      },
      {
        email: 'user@example.com',
        username: 'user',
        passwordHash: 'user', // Replace with a real hash in production
      },
    ],
    skipDuplicates: true,
  });
}
