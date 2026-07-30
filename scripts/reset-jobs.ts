import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const deleted = await prisma.jobCard.deleteMany();
  await prisma.jobSequence.upsert({
    where: { id: 1 },
    update: { lastNum: 0 },
    create: { id: 1, lastNum: 0 },
  });
  console.log(`Deleted ${deleted.count} job(s). Next job number will be UT 1.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
