import { seedUsers } from './seed/user';
import prisma from '../lib/db';

async function main() {
  await seedUsers();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
