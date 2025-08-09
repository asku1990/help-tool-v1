import prisma from '../lib/db';

async function main() {
  // Intentionally left empty – no user seeding required
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
