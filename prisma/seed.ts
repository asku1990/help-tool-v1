import prisma from '../lib/db';

async function main() {
  // Add your organization/company user seeding here as needed.
  // console.log('Seed: no demo seeding.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
